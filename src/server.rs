//! Axum HTTP server. Owns `/api/*`, falls through to the embedded UI (or the
//! Vite dev proxy) for everything else.
//!
//! The server is a thin layer on top of `Store` (SQLite) and `SecretManager`.
//! The watcher refreshes the SQLite projection whenever YAML files change on
//! disk.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::process::Stdio;

use anyhow::Context;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use axum::routing::{get, post};
use axum::Router;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::process::{Child, Command};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

use crate::assets;
use crate::config::ApiRequest;
use crate::db::{Draft, ProjectView, ResponseHistory, Run, Store};
use crate::project::{self, ProjectPaths};
use crate::proxy;
use crate::runner::{self, RunContext, RunRegistry, RunRequestInput};
use crate::secrets::SecretManager;
use crate::watcher::{self, ProjectWatcher};

#[derive(Clone, Debug)]
pub enum ServerMode {
    /// Serve the UI from assets embedded in the binary at compile time.
    Embedded,
    /// Reverse-proxy non-API traffic (including HMR ws) to a Vite dev server.
    DevProxy {
        upstream: SocketAddr,
        spawn_vite: bool,
        web_dir: PathBuf,
    },
}

#[derive(Clone)]
pub struct AppState {
    pub mode: ServerMode,
    pub paths: ProjectPaths,
    pub store: Store,
    pub secrets: SecretManager,
    pub registry: RunRegistry,
}

impl AppState {
    fn run_context(&self) -> RunContext {
        RunContext {
            store: self.store.clone(),
            secrets: self.secrets.clone(),
            registry: self.registry.clone(),
            project_root: self.paths.root.clone(),
        }
    }
}

pub async fn run(
    addr: SocketAddr,
    mode: ServerMode,
    open_browser: bool,
    paths: ProjectPaths,
) -> anyhow::Result<()> {
    let snapshot = project::load_snapshot(&paths)?;
    let store = Store::open(&paths.db_path)?;
    store.replace_snapshot(&snapshot)?;
    let secrets = SecretManager::new(store.clone(), &paths.secret_key_path)?;

    let _watcher: ProjectWatcher = watcher::spawn(paths.clone(), store.clone())
        .context("failed to start project file watcher")?;

    let _vite_child: Option<Child> = match &mode {
        ServerMode::DevProxy {
            upstream,
            spawn_vite,
            web_dir,
        } if *spawn_vite => {
            let child = spawn_vite_dev(web_dir, upstream.port())
                .await
                .context("failed to spawn vite dev server")?;
            wait_for_vite(*upstream).await?;
            Some(child)
        }
        _ => None,
    };

    let state = AppState {
        mode: mode.clone(),
        paths,
        store,
        secrets,
        registry: RunRegistry::new(),
    };

    let api = Router::new()
        .route("/api/health", get(health))
        .route("/api/version", get(version))
        .route("/api/project", get(project_view))
        .route("/api/environments", get(environments))
        .route("/api/requests", get(requests))
        .route("/api/drafts", get(drafts))
        .route(
            "/api/drafts/{request_id}",
            post(upsert_draft).delete(delete_draft),
        )
        .route("/api/drafts/{request_id}/save", post(save_draft))
        .route("/api/history", get(history).delete(clear_history))
        .route("/api/history/{id}", axum::routing::delete(delete_history))
        .route("/api/runs", get(list_runs))
        .route("/api/runs/{run_id}", get(get_run))
        .route("/api/runs/{run_id}/cancel", post(cancel_run))
        .route("/api/requests/{request_id}/run", post(run_request_handler))
        .route("/api/secrets", get(list_secrets))
        .route(
            "/api/secrets/{name}",
            post(upsert_secret).delete(delete_secret),
        );

    let app = api
        .fallback(ui_fallback)
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind {addr}"))?;
    let bound = listener.local_addr().unwrap_or(addr);

    let url = format!("http://{bound}/");
    info!(%url, mode = ?mode_label(&mode), "boson listening");

    if open_browser {
        if let Err(e) = open::that_detached(&url) {
            warn!(error = %e, "could not open browser automatically");
        }
    }

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("server error")?;

    Ok(())
}

fn mode_label(mode: &ServerMode) -> &'static str {
    match mode {
        ServerMode::Embedded => "embedded",
        ServerMode::DevProxy { .. } => "dev-proxy",
    }
}

async fn health() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn version() -> Json<Value> {
    Json(json!({
        "name": env!("CARGO_PKG_NAME"),
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn project_view(State(state): State<AppState>) -> Result<Json<ProjectView>, ApiError> {
    Ok(Json(state.store.project_view()?))
}

async fn environments(
    State(state): State<AppState>,
) -> Result<Json<Vec<crate::config::Environment>>, ApiError> {
    Ok(Json(state.store.environments()?))
}

async fn requests(State(state): State<AppState>) -> Result<Json<Vec<ApiRequest>>, ApiError> {
    Ok(Json(state.store.requests()?))
}

async fn drafts(State(state): State<AppState>) -> Result<Json<Vec<Draft>>, ApiError> {
    Ok(Json(state.store.drafts()?))
}

async fn upsert_draft(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
    Json(mut request): Json<ApiRequest>,
) -> Result<Json<Draft>, ApiError> {
    request.id = request_id.clone();
    Ok(Json(state.store.upsert_draft(&request_id, &request)?))
}

async fn delete_draft(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_draft(&request_id)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn save_draft(
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

#[derive(Debug, Deserialize)]
struct HistoryQuery {
    limit: Option<i64>,
    request_id: Option<String>,
}

async fn history(
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

async fn delete_history(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_history(id)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn clear_history(State(state): State<AppState>) -> Result<StatusCode, ApiError> {
    state.store.clear_history()?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
struct RunsQuery {
    limit: Option<i64>,
}

async fn list_runs(
    State(state): State<AppState>,
    Query(query): Query<RunsQuery>,
) -> Result<Json<Vec<Run>>, ApiError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 500);
    Ok(Json(state.store.list_runs(limit)?))
}

async fn get_run(
    State(state): State<AppState>,
    Path(run_id): Path<String>,
) -> Result<Json<Run>, ApiError> {
    state
        .store
        .run(&run_id)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found(format!("run `{run_id}` not found")))
}

async fn cancel_run(
    State(state): State<AppState>,
    Path(run_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let canceled = state.registry.cancel(&run_id).await;
    Ok(Json(json!({ "canceled": canceled })))
}

#[derive(Debug, Deserialize)]
struct RunBody {
    #[serde(default)]
    environment_id: Option<String>,
}

async fn run_request_handler(
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

#[derive(Debug, Deserialize)]
struct SecretBody {
    value: String,
}

async fn list_secrets(State(state): State<AppState>) -> Result<Json<Vec<String>>, ApiError> {
    Ok(Json(state.secrets.list_names()?))
}

async fn upsert_secret(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(body): Json<SecretBody>,
) -> Result<StatusCode, ApiError> {
    state.secrets.set(&name, &body.value)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_secret(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.secrets.delete(&name)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn ui_fallback(
    State(state): State<AppState>,
    req: axum::http::Request<axum::body::Body>,
) -> axum::response::Response {
    match state.mode {
        ServerMode::Embedded => assets::serve(req).await,
        ServerMode::DevProxy { upstream, .. } => proxy::forward(upstream, req).await,
    }
}

async fn spawn_vite_dev(web_dir: &PathBuf, port: u16) -> anyhow::Result<Child> {
    if !web_dir.join("package.json").exists() {
        anyhow::bail!("no package.json found in {}", web_dir.display());
    }

    if !web_dir.join("node_modules").exists() {
        info!(dir = %web_dir.display(), "installing web dependencies (pnpm install)");
        let status = Command::new("pnpm")
            .arg("install")
            .current_dir(web_dir)
            .status()
            .await
            .context("failed to run `pnpm install`")?;
        if !status.success() {
            anyhow::bail!("`pnpm install` exited with status {status}");
        }
    }

    info!(port, dir = %web_dir.display(), "spawning `pnpm dev`");
    let child = Command::new("pnpm")
        .args(["dev", "--port", &port.to_string()])
        .env("VITE_DEV_PORT", port.to_string())
        .current_dir(web_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .context("failed to spawn `pnpm dev`")?;

    Ok(child)
}

async fn wait_for_vite(upstream: SocketAddr) -> anyhow::Result<()> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
    loop {
        if tokio::net::TcpStream::connect(upstream).await.is_ok() {
            info!(%upstream, "vite dev server is ready");
            return Ok(());
        }
        if std::time::Instant::now() >= deadline {
            anyhow::bail!("vite dev server at {upstream} did not become ready in 30s");
        }
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install ctrl_c handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("shutting down");
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn not_found(message: String) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message,
        }
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(value: anyhow::Error) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: value.to_string(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            Json(json!({
                "error": self.message,
            })),
        )
            .into_response()
    }
}
