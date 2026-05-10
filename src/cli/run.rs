//! `boson run <id>` — execute a single request and pretty-print the response.

use anyhow::Context;

use crate::db::{RunStatus, Store};
use crate::project;
use crate::runner::{run_request, RunContext, RunOutcome, RunRegistry, RunRequestInput};
use crate::secrets::SecretManager;

use super::args::RunArgs;

pub(super) async fn run_cmd(args: RunArgs) -> anyhow::Result<()> {
    let paths = project::discover(Some(&args.project_dir))?;
    let snapshot = project::load_snapshot(&paths)?;
    let store = Store::open(&paths.db_path)?;
    store.replace_snapshot(&snapshot)?;
    let secrets = SecretManager::new(store.clone(), &paths.secret_key_path)?;

    let ctx = RunContext {
        store: store.clone(),
        secrets,
        registry: RunRegistry::new(),
        project_root: paths.root.clone(),
    };
    let run_id = generate_run_id();
    let outcome = run_request(
        ctx,
        run_id,
        args.request_id,
        RunRequestInput {
            environment_id: args.environment,
        },
    )
    .await
    .context("run failed")?;

    print_run_outcome(&outcome, args.raw);
    Ok(())
}

fn generate_run_id() -> String {
    use chrono::Utc;
    use std::time::SystemTime;
    let micros = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_micros())
        .unwrap_or(0);
    format!("run_{}_{}", Utc::now().format("%Y%m%dT%H%M%S"), micros)
}

fn print_run_outcome(outcome: &RunOutcome, raw: bool) {
    let history = match &outcome.history {
        Some(history) => history,
        None => {
            println!(
                "run {} ended without history (status={})",
                outcome.run.id,
                run_status_label(&outcome.run.status)
            );
            if let Some(error) = &outcome.run.error {
                println!("error: {error}");
            }
            return;
        }
    };

    println!(
        "{} {} -> {} ({} ms)",
        history.method,
        history.url,
        history
            .status
            .map(|s| s.to_string())
            .unwrap_or_else(|| "ERR".to_string()),
        history.duration_ms,
    );
    if let Some(err) = &history.error {
        println!("error: {err}");
    }
    println!();
    if let serde_json::Value::Object(map) = &history.response_headers {
        for (key, value) in map {
            println!("{key}: {}", value.as_str().unwrap_or_default());
        }
    }
    println!();
    if raw || history.response_body.len() <= 8 * 1024 {
        println!("{}", history.response_body);
    } else {
        println!(
            "{}\n... [truncated, {} bytes total; pass --raw for full body]",
            &history.response_body[..8 * 1024],
            history.response_body.len()
        );
    }
    if history.response_truncated {
        println!("(response body was truncated by server-side max_response_bytes)");
    }
}

fn run_status_label(status: &RunStatus) -> &'static str {
    match status {
        RunStatus::Pending => "pending",
        RunStatus::Running => "running",
        RunStatus::Completed => "completed",
        RunStatus::Failed => "failed",
        RunStatus::Canceled => "canceled",
    }
}
