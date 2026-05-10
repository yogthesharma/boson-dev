//! Axum route table. All `/api/*` lives here; everything else falls through
//! to `fallback::ui_fallback` (embedded UI or Vite dev proxy).

mod fallback;
mod history;
mod meta;
mod project;
mod runs;
mod secrets;

use axum::routing::{get, post};
use axum::Router;

use super::state::AppState;

pub(super) fn router(state: AppState) -> Router {
    let api = Router::new()
        .route("/api/health", get(meta::health))
        .route("/api/version", get(meta::version))
        .route("/api/project", get(project::project_view))
        .route("/api/environments", get(project::environments))
        .route("/api/requests", get(project::requests))
        .route("/api/drafts", get(project::drafts))
        .route(
            "/api/drafts/{request_id}",
            post(project::upsert_draft).delete(project::delete_draft),
        )
        .route("/api/drafts/{request_id}/save", post(project::save_draft))
        .route(
            "/api/history",
            get(history::history).delete(history::clear_history),
        )
        .route(
            "/api/history/{id}",
            axum::routing::delete(history::delete_history),
        )
        .route("/api/runs", get(runs::list_runs))
        .route("/api/runs/{run_id}", get(runs::get_run))
        .route("/api/runs/{run_id}/cancel", post(runs::cancel_run))
        .route(
            "/api/requests/{request_id}/run",
            post(runs::run_request_handler),
        )
        .route("/api/secrets", get(secrets::list_secrets))
        .route(
            "/api/secrets/{name}",
            post(secrets::upsert_secret).delete(secrets::delete_secret),
        );

    api.fallback(fallback::ui_fallback).with_state(state)
}
