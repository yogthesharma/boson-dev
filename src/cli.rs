use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use clap::{Parser, Subcommand};

use crate::server::{self, ServerMode};

#[derive(Debug, Parser)]
#[command(
    name = "boson",
    version,
    about = "Boson CLI with an embedded Vite + React UI",
    propagate_version = true
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Run the production server, serving the UI from assets embedded in the binary.
    Serve(ServeArgs),

    /// Run the development server. Spawns `pnpm dev` in `web/` and reverse-proxies
    /// non-API requests (including HMR websockets) to the Vite dev server.
    Dev(DevArgs),
}

#[derive(Debug, clap::Args)]
pub struct ServeArgs {
    /// Address to bind the HTTP server to.
    #[arg(long, default_value = "127.0.0.1")]
    pub host: IpAddr,

    /// Port to bind the HTTP server to.
    #[arg(long, short, default_value_t = 8787)]
    pub port: u16,

    /// Do not open the UI in a browser on startup.
    #[arg(long)]
    pub no_open: bool,
}

#[derive(Debug, clap::Args)]
pub struct DevArgs {
    /// Address to bind the HTTP server to.
    #[arg(long, default_value = "127.0.0.1")]
    pub host: IpAddr,

    /// Port to bind the HTTP server to.
    #[arg(long, short, default_value_t = 8787)]
    pub port: u16,

    /// Port the Vite dev server listens on (and the Rust server proxies to).
    #[arg(long, default_value_t = 5173)]
    pub vite_port: u16,

    /// Don't spawn `pnpm dev` automatically. Bring your own Vite on `--vite-port`.
    #[arg(long)]
    pub no_spawn_vite: bool,

    /// Path to the Vite project (containing package.json + vite.config).
    #[arg(long, default_value = "web")]
    pub web_dir: std::path::PathBuf,

    /// Do not open the UI in a browser on startup.
    #[arg(long)]
    pub no_open: bool,
}

impl Cli {
    pub async fn run(self) -> anyhow::Result<()> {
        match self.command {
            Command::Serve(args) => {
                let addr = SocketAddr::new(args.host, args.port);
                let mode = ServerMode::Embedded;
                server::run(addr, mode, !args.no_open).await
            }
            Command::Dev(args) => {
                let addr = SocketAddr::new(args.host, args.port);
                let upstream = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), args.vite_port);
                let mode = ServerMode::DevProxy {
                    upstream,
                    spawn_vite: !args.no_spawn_vite,
                    web_dir: args.web_dir,
                };
                server::run(addr, mode, !args.no_open).await
            }
        }
    }
}
