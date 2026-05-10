//! Project, environment, request, and draft endpoints. These all read from
//! (or mutate) the SQLite projection. The watcher keeps the projection in
//! sync with YAML.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;

use crate::config::ApiRequest;
use crate::db::{Draft, ProjectView};
use crate::project;
use crate::server::{ApiError, AppState};

pub(super) async fn project_view(
    State(state): State<AppState>,
) -> Result<Json<ProjectView>, ApiError> {
    Ok(Json(state.store.project_view()?))
}

pub(super) async fn environments(
    State(state): State<AppState>,
) -> Result<Json<Vec<crate::config::Environment>>, ApiError> {
    Ok(Json(state.store.environments()?))
}

pub(super) async fn requests(
    State(state): State<AppState>,
) -> Result<Json<Vec<ApiRequest>>, ApiError> {
    Ok(Json(state.store.requests()?))
}

pub(super) async fn drafts(
    State(state): State<AppState>,
) -> Result<Json<Vec<Draft>>, ApiError> {
    Ok(Json(state.store.drafts()?))
}

pub(super) async fn upsert_draft(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
    Json(mut request): Json<ApiRequest>,
) -> Result<Json<Draft>, ApiError> {
    request.id = request_id.clone();
    Ok(Json(state.store.upsert_draft(&request_id, &request)?))
}

pub(super) async fn delete_draft(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_draft(&request_id)?;
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn save_draft(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
) -> Result<Json<Vec<ApiRequest>>, ApiError> {
    let draft = state
        .store
        .drafts()?
        .into_iter()
        .find(|draft| draft.request_id == request_id)
        .ok_or_else(|| ApiError::not_found(format!("draft `{request_id}` not found")))?;

    project::save_request(&state.paths, &draft.request)?;
    state.store.replace_request_from_save(&draft.request)?;
    state.store.delete_draft(&request_id)?;
    Ok(Json(state.store.requests()?))
}
