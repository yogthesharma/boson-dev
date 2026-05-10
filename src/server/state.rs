//! Shared server state plumbed into every Axum handler.

use std::net::SocketAddr;
use std::path::PathBuf;

use crate::db::Store;
use crate::project::ProjectPaths;
use crate::runner::{RunContext, RunRegistry};
use crate::secrets::SecretManager;

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
    pub fn run_context(&self) -> RunContext {
        RunContext {
            store: self.store.clone(),
            secrets: self.secrets.clone(),
            registry: self.registry.clone(),
            project_root: self.paths.root.clone(),
        }
    }
}
