//! Catch-all route that serves either embedded assets or the Vite dev proxy
//! depending on the running mode.

use axum::extract::State;

use crate::assets;
use crate::proxy;
use crate::server::{AppState, ServerMode};

pub(super) async fn ui_fallback(
    State(state): State<AppState>,
    req: axum::http::Request<axum::body::Body>,
) -> axum::response::Response {
    match state.mode {
        ServerMode::Embedded => assets::serve(req).await,
        ServerMode::DevProxy { upstream, .. } => proxy::forward(upstream, req).await,
    }
}
