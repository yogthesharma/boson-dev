//! Run lifecycle endpoints — listing, fetching, cancelling, and starting
//! a new run.

use axum::extract::{Path, Query, State};
use axum::response::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::db::Run;
use crate::runner::{self, RunRequestInput};
use crate::server::{ApiError, AppState};

#[derive(Debug, Deserialize)]
pub(super) struct RunsQuery {
    limit: Option<i64>,
}

pub(super) async fn list_runs(
    State(state): State<AppState>,
    Query(query): Query<RunsQuery>,
) -> Result<Json<Vec<Run>>, ApiError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 500);
    Ok(Json(state.store.list_runs(limit)?))
}

pub(super) async fn get_run(
    State(state): State<AppState>,
    Path(run_id): Path<String>,
) -> Result<Json<Run>, ApiError> {
    state
        .store
        .run(&run_id)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found(format!("run `{run_id}` not found")))
}

pub(super) async fn cancel_run(
    State(state): State<AppState>,
    Path(run_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let canceled = state.registry.cancel(&run_id).await;
    Ok(Json(json!({ "canceled": canceled })))
}

#[derive(Debug, Deserialize)]
pub(super) struct RunBody {
    #[serde(default)]
    environment_id: Option<String>,
}

pub(super) async fn run_request_handler(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
    Json(body): Json<RunBody>,
) -> Result<Json<runner::RunOutcome>, ApiError> {
    let run_id = generate_run_id();
    let input = RunRequestInput {
        environment_id: body.environment_id,
    };
    let ctx = state.run_context();
    let outcome = runner::run_request(ctx, run_id, request_id, input).await?;
    Ok(Json(outcome))
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
