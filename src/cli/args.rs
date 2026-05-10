//! Argument structs for every CLI subcommand. Kept together so the entire
//! command surface is easy to scan in one file.

use std::net::IpAddr;
use std::path::PathBuf;

use clap::Args;

#[derive(Debug, Args)]
pub struct InitArgs {
    /// Directory where Boson project files should be created.
    #[arg(default_value = ".")]
    pub dir: PathBuf,

    /// Project name to write to boson.yml.
    #[arg(long)]
    pub name: Option<String>,

    /// Overwrite sample files if they already exist.
    #[arg(long)]
    pub force: bool,
}

#[derive(Debug, Args)]
pub struct ServeArgs {
    /// Boson project directory, or any child directory inside it.
    #[arg(long, default_value = ".")]
    pub project_dir: PathBuf,

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

#[derive(Debug, Args)]
pub struct DevArgs {
    /// Boson project directory, or any child directory inside it.
    #[arg(long, default_value = ".")]
    pub project_dir: PathBuf,

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
    pub web_dir: PathBuf,

    /// Do not open the UI in a browser on startup.
    #[arg(long)]
    pub no_open: bool,
}

#[derive(Debug, Args)]
pub struct RunArgs {
    /// Boson project directory.
    #[arg(long, default_value = ".")]
    pub project_dir: PathBuf,

    /// Environment id to use (defaults to the first configured environment).
    #[arg(long)]
    pub environment: Option<String>,

    /// Print the full response body even when it would be truncated for the
    /// terminal.
    #[arg(long)]
    pub raw: bool,

    /// Request id to execute.
    pub request_id: String,
}

#[derive(Debug, Args)]
pub struct LintArgs {
    /// Boson project directory.
    #[arg(long, default_value = ".")]
    pub project_dir: PathBuf,
}

#[derive(Debug, Args)]
pub struct UpdateArgs {
    /// `<owner>/<repo>` GitHub slug to look for releases in.
    #[arg(long, env = "BOSON_UPDATE_REPO")]
    pub repo: Option<String>,

    /// Asset name pattern to download (defaults to `boson-<target>.tar.gz`).
    #[arg(long, env = "BOSON_UPDATE_ASSET")]
    pub asset_name: Option<String>,

    /// Print the available release without applying it.
    #[arg(long)]
    pub dry_run: bool,
}
