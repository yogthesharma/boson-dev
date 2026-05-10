//! Secret management endpoints. Secret values are write-only — the API
//! only ever returns the list of names so callers can present an editor.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;

use crate::server::{ApiError, AppState};

#[derive(Debug, Deserialize)]
pub(super) struct SecretBody {
    value: String,
}

pub(super) async fn list_secrets(
    State(state): State<AppState>,
) -> Result<Json<Vec<String>>, ApiError> {
    Ok(Json(state.secrets.list_names()?))
}

pub(super) async fn upsert_secret(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(body): Json<SecretBody>,
) -> Result<StatusCode, ApiError> {
    state.secrets.set(&name, &body.value)?;
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn delete_secret(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.secrets.delete(&name)?;
    Ok(StatusCode::NO_CONTENT)
}
