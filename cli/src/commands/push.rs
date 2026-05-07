use std::path::Path;

use anyhow::{bail, Context, Result};
use serde::Deserialize;

use crate::commands::credentials;
use crate::schema;

const DEFAULT_SERVER: &str = "http://localhost:3001";

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum PushResponse {
    Ok {
        ok: bool,
        workspace: String,
        requests: usize,
        environments: usize,
    },
    Err {
        error: String,
        #[serde(default)]
        path: Option<String>,
    },
}

pub fn run(file: &Path, server: Option<&str>, dry_run: bool) -> Result<()> {
    let payload = schema::load(file)
        .with_context(|| format!("validating {}", file.display()))?;

    println!(
        "validated {}: workspace={} envs={} requests={}",
        file.display(),
        payload.workspace,
        payload.environments.len(),
        payload.requests.len()
    );

    if dry_run {
        println!("dry-run: not posting to the server.");
        return Ok(());
    }

    let server = resolve_server(server);
    let url = format!("{}/v1/canonical", server.trim_end_matches('/'));

    let client = reqwest::blocking::Client::new();
    let mut req = client.post(&url).json(&payload);
    if let Some(token) = credentials::load_token() {
        req = req.header("Authorization", format!("Bearer {token}"));
    }
    let resp = req.send().with_context(|| format!("POST {url}"))?;

    let status = resp.status();
    let body: PushResponse = resp
        .json()
        .with_context(|| "parsing server response as JSON")?;

    match body {
        PushResponse::Ok {
            ok: true,
            workspace,
            requests,
            environments,
        } => {
            println!(
                "pushed: workspace={workspace} envs={environments} requests={requests}"
            );
            Ok(())
        }
        PushResponse::Err { error, path } => {
            if status == 401 {
                bail!(
                    "server returned 401 (unauthorized). Run `boson login --email … --password …` or set BOSON_AUTH_DISABLED=1 on the server for local dev. Details: {error}"
                );
            }
            if let Some(p) = path {
                bail!("server rejected payload at {p}: {error}");
            }
            bail!("server rejected payload: {error}");
        }
        PushResponse::Ok { .. } => {
            bail!("unexpected server response (HTTP {status})");
        }
    }
}

fn resolve_server(cli_arg: Option<&str>) -> String {
    if let Some(s) = cli_arg {
        return s.to_owned();
    }
    if let Ok(s) = std::env::var("BOSON_SERVER_URL") {
        if !s.trim().is_empty() {
            return s;
        }
    }
    DEFAULT_SERVER.to_owned()
}
