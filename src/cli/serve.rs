//! `boson serve` and `boson dev` — both bring up the Axum server, just with
//! different fallthrough modes (embedded assets vs Vite dev proxy).

use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use crate::project;
use crate::server::{self, ServerMode};

use super::args::{DevArgs, ServeArgs};

pub(super) async fn serve_cmd(args: ServeArgs) -> anyhow::Result<()> {
    let addr = SocketAddr::new(args.host, args.port);
    let mode = ServerMode::Embedded;
    let paths = project::discover(Some(&args.project_dir))?;
    server::run(addr, mode, !args.no_open, paths).await
}

pub(super) async fn dev_cmd(args: DevArgs) -> anyhow::Result<()> {
    let addr = SocketAddr::new(args.host, args.port);
    let upstream = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), args.vite_port);
    let mode = ServerMode::DevProxy {
        upstream,
        spawn_vite: !args.no_spawn_vite,
        web_dir: args.web_dir,
    };
    let paths = project::discover(Some(&args.project_dir))?;
    server::run(addr, mode, !args.no_open, paths).await
}
