//! Response history endpoints.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;

use crate::db::ResponseHistory;
use crate::server::{ApiError, AppState};

#[derive(Debug, Deserialize)]
pub(super) struct HistoryQuery {
    limit: Option<i64>,
    request_id: Option<String>,
}

pub(super) async fn history(
    State(state): State<AppState>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<ResponseHistory>>, ApiError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 1000);
    let items = match query.request_id {
        Some(request_id) => state.store.history_for_request(&request_id, limit)?,
        None => state.store.history(limit)?,
    };
    Ok(Json(items))
}

pub(super) async fn delete_history(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_history(id)?;
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn clear_history(
    State(state): State<AppState>,
) -> Result<StatusCode, ApiError> {
    state.store.clear_history()?;
    Ok(StatusCode::NO_CONTENT)
}
