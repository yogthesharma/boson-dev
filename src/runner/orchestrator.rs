//! Public runner entrypoint. Manages the run row in SQLite, hooks up the
//! cancellation token, calls into `resolve` and `http`, and writes a history
//! row regardless of success or failure.

use std::path::PathBuf;
use std::time::Instant;

use anyhow::Context;
use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

use crate::db::{NewHistory, ResponseHistory, Run, RunStatus, Store};
use crate::secrets::SecretManager;

use super::http::send_request;
use super::registry::RunRegistry;
use super::resolve::{resolve_request, Resolver};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RunRequestInput {
    #[serde(default)]
    pub environment_id: Option<String>,
}

#[derive(Clone)]
pub struct RunContext {
    pub store: Store,
    pub secrets: SecretManager,
    pub registry: RunRegistry,
    pub project_root: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct RunOutcome {
    pub run: Run,
    pub history: Option<ResponseHistory>,
}

pub async fn run_request(
    ctx: RunContext,
    run_id: String,
    request_id: String,
    input: RunRequestInput,
) -> anyhow::Result<RunOutcome> {
    ctx.store
        .create_run(&run_id, &request_id, input.environment_id.as_deref())?;

    let token = CancellationToken::new();
    ctx.registry.insert(run_id.clone(), token.clone()).await;

    let result = execute(&ctx, &run_id, &request_id, &input, token).await;
    ctx.registry.remove(&run_id).await;

    let (status, history, error) = match &result {
        Ok(history) => (RunStatus::Completed, Some(history.clone()), None),
        Err(RunError::Canceled) => (RunStatus::Canceled, None, Some("canceled".to_string())),
        Err(RunError::Other(err)) => (RunStatus::Failed, None, Some(err.to_string())),
    };

    ctx.store.mark_run_status(
        &run_id,
        status.clone(),
        history.as_ref().map(|h| h.id),
        error.clone(),
    )?;

    let run = ctx
        .store
        .run(&run_id)?
        .context("run row should exist after marking status")?;

    Ok(RunOutcome { run, history })
}

#[derive(Debug)]
enum RunError {
    Canceled,
    Other(anyhow::Error),
}

impl<E: Into<anyhow::Error>> From<E> for RunError {
    fn from(value: E) -> Self {
        RunError::Other(value.into())
    }
}

async fn execute(
    ctx: &RunContext,
    run_id: &str,
    request_id: &str,
    input: &RunRequestInput,
    token: CancellationToken,
) -> Result<ResponseHistory, RunError> {
    let request = ctx
        .store
        .effective_request(request_id)
        .map_err(RunError::Other)?
        .ok_or_else(|| RunError::Other(anyhow::anyhow!("request `{request_id}` not found")))?;

    let environment = match &input.environment_id {
        Some(id) => ctx.store.environment(id).map_err(RunError::Other)?,
        None => ctx
            .store
            .environments()
            .map_err(RunError::Other)?
            .into_iter()
            .next(),
    };

    let environment_id = environment.as_ref().map(|env| env.id.clone());
    let variables = environment
        .as_ref()
        .map(|env| env.variables.clone())
        .unwrap_or_default();

    let resolver = Resolver {
        variables,
        secrets: &ctx.secrets,
    };

    let resolved =
        resolve_request(&request, &resolver, &ctx.project_root).map_err(RunError::Other)?;

    let started = Instant::now();
    let outcome = tokio::select! {
        biased;
        _ = token.cancelled() => Err(RunError::Canceled),
        result = send_request(&resolved, &request.options) => match result {
            Ok(value) => Ok(value),
            Err(err) => Err(RunError::Other(err)),
        }
    };
    let duration_ms = started.elapsed().as_millis();

    match outcome {
        Ok(result) => {
            let item = NewHistory {
                run_id: run_id.to_string(),
                request_id: request_id.to_string(),
                environment_id,
                method: resolved.method,
                url: resolved.url,
                status: Some(result.status),
                duration_ms,
                response_headers: result.headers,
                response_body: result.body,
                response_truncated: result.truncated,
                error: None,
            };
            ctx.store.insert_history(item).map_err(RunError::Other)
        }
        Err(RunError::Canceled) => Err(RunError::Canceled),
        Err(RunError::Other(err)) => {
            let item = NewHistory {
                run_id: run_id.to_string(),
                request_id: request_id.to_string(),
                environment_id,
                method: request.method,
                url: request.url,
                status: None,
                duration_ms,
                response_headers: serde_json::Value::Object(Default::default()),
                response_body: String::new(),
                response_truncated: false,
                error: Some(err.to_string()),
            };
            ctx.store.insert_history(item).map_err(RunError::Other)?;
            Err(RunError::Other(err))
        }
    }
}
