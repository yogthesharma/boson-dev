use std::net::SocketAddr;
use std::path::PathBuf;
use std::process::Stdio;

use anyhow::Context;
use axum::Router;
use axum::extract::State;
use axum::response::Json;
use axum::routing::get;
use serde_json::{Value, json};
use tokio::process::{Child, Command};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

use crate::assets;
use crate::proxy;

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
}

pub async fn run(addr: SocketAddr, mode: ServerMode, open_browser: bool) -> anyhow::Result<()> {
    // In dev mode, optionally spawn `pnpm dev` and wait for Vite to be ready
    // before we accept connections. This keeps the UX "boson dev → page works".
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

    let state = AppState { mode: mode.clone() };

    let api = Router::new()
        .route("/api/health", get(health))
        .route("/api/version", get(version));

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

    // Run `pnpm install` if node_modules is missing. Best-effort, non-fatal.
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
