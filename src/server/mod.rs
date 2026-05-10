//! Axum HTTP server. Owns `/api/*`, falls through to the embedded UI (or the
//! Vite dev proxy) for everything else.
//!
//! The server is a thin layer on top of `Store` (SQLite) and `SecretManager`.
//! The watcher refreshes the SQLite projection whenever YAML files change on
//! disk.

mod error;
mod routes;
mod shutdown;
mod state;
mod vite;

pub use error::ApiError;
pub use state::{AppState, ServerMode};

use std::net::SocketAddr;

use anyhow::Context;
use tokio::process::Child;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

use crate::db::Store;
use crate::project::{self, ProjectPaths};
use crate::runner::RunRegistry;
use crate::secrets::SecretManager;
use crate::watcher::{self, ProjectWatcher};

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
            let child = vite::spawn_vite_dev(web_dir, upstream.port())
                .await
                .context("failed to spawn vite dev server")?;
            vite::wait_for_vite(*upstream).await?;
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

    let app = routes::router(state)
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
        .with_graceful_shutdown(shutdown::shutdown_signal())
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
