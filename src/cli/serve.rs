//! `boson serve` always ships in the binary. `boson dev` (Vite + HMR) exists only
//! in contributor builds (`--no-default-features`).

use std::net::SocketAddr;
#[cfg(not(feature = "embed-ui"))]
use std::net::{IpAddr, Ipv4Addr};
#[cfg(not(feature = "embed-ui"))]
use std::path::{Path, PathBuf};

use crate::project;
use crate::server::{self, ServerMode};

use super::args::ServeArgs;
#[cfg(not(feature = "embed-ui"))]
use super::args::DevArgs;

pub(super) async fn serve_cmd(args: ServeArgs) -> anyhow::Result<()> {
    let addr = SocketAddr::new(args.host, args.port);
    let mode = ServerMode::Embedded;
    let paths = project::discover(Some(&args.project_dir))?;
    server::run(addr, mode, !args.no_open, paths).await
}

#[cfg(not(feature = "embed-ui"))]
pub(super) async fn dev_cmd(args: DevArgs) -> anyhow::Result<()> {
    let paths = project::discover(Some(&args.project_dir))?;
    let web_dir = resolve_web_dir(&paths.root, args.web_dir);

    if !args.no_spawn_vite && !web_dir.join("package.json").exists() {
        anyhow::bail!(
            "no Vite app (package.json) found at {}\n\
             \n\
             For a YAML-only project like this one, use the embedded UI:\n\
               boson serve --project-dir {}\n\
             \n\
             For hot-reload UI development, point at the Boson repo's web app:\n\
               boson dev --project-dir {} --web-dir /path/to/boson/web\n\
             \n\
             Or run `pnpm dev` yourself and pass:\n\
               boson dev --project-dir {} --no-spawn-vite --vite-port 5173",
            web_dir.display(),
            paths.root.display(),
            paths.root.display(),
            paths.root.display(),
        );
    }

    let addr = SocketAddr::new(args.host, args.port);
    let upstream = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), args.vite_port);
    let mode = ServerMode::DevProxy {
        upstream,
        spawn_vite: !args.no_spawn_vite,
        web_dir,
    };
    server::run(addr, mode, !args.no_open, paths).await
}

/// `web` is relative to cwd (monorepo) or to the discovered project root.
#[cfg(not(feature = "embed-ui"))]
fn resolve_web_dir(project_root: &Path, web_dir: PathBuf) -> PathBuf {
    if web_dir.is_absolute() {
        return web_dir;
    }
    let cwd = std::env::current_dir().unwrap_or_else(|_| project_root.to_path_buf());
    let cwd_candidate = cwd.join(&web_dir);
    if cwd_candidate.join("package.json").exists() {
        return cwd_candidate;
    }
    let project_candidate = project_root.join(&web_dir);
    if project_candidate.join("package.json").exists() {
        return project_candidate;
    }
    cwd_candidate
}
