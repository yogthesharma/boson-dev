use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::PathBuf;

use anyhow::Context;
use clap::{Parser, Subcommand};

use crate::db::Store;
use crate::project;
use crate::runner::{run_request, RunContext, RunRegistry, RunRequestInput};
use crate::secrets::SecretManager;
use crate::server::{self, ServerMode};

#[derive(Debug, Parser)]
#[command(
    name = "boson",
    version,
    about = "Boson \u{2014} a local-first REST API client",
    long_about = "Boson is a local-first REST API client. The user's YAML files are the source \
                  of truth; the Rust server projects them into SQLite and serves a Vite + React \
                  UI for editing and execution.",
    propagate_version = true
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Create a Boson project (boson.yml + boson/ + .boson/) in a directory.
    Init(InitArgs),

    /// Run the production server, serving the UI from assets embedded in the binary.
    Serve(ServeArgs),

    /// Run the development server. Spawns `pnpm dev` in `web/` and reverse-proxies
    /// non-API requests (including HMR websockets) to the Vite dev server.
    Dev(DevArgs),

    /// Execute a request by id and print the response to stdout.
    Run(RunArgs),

    /// Validate the project's YAML files and report any errors.
    Lint(LintArgs),

    /// Validate the project (alias for `lint`).
    Check(LintArgs),

    /// Update the boson binary in place by checking the configured release feed.
    Update(UpdateArgs),
}

#[derive(Debug, clap::Args)]
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

#[derive(Debug, clap::Args)]
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

#[derive(Debug, clap::Args)]
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

#[derive(Debug, clap::Args)]
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

#[derive(Debug, clap::Args)]
pub struct LintArgs {
    /// Boson project directory.
    #[arg(long, default_value = ".")]
    pub project_dir: PathBuf,
}

#[derive(Debug, clap::Args)]
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

impl Cli {
    pub async fn run(self) -> anyhow::Result<()> {
        match self.command {
            Command::Init(args) => init(args),
            Command::Serve(args) => serve_cmd(args).await,
            Command::Dev(args) => dev_cmd(args).await,
            Command::Run(args) => run_cmd(args).await,
            Command::Lint(args) | Command::Check(args) => lint_cmd(args),
            Command::Update(args) => update_cmd(args),
        }
    }
}

fn init(args: InitArgs) -> anyhow::Result<()> {
    let paths = project::init(&args.dir, args.name, args.force)?;
    let snapshot = project::load_snapshot(&paths)?;
    let store = Store::open(&paths.db_path)?;
    store.replace_snapshot(&snapshot)?;
    SecretManager::new(store, &paths.secret_key_path)?;
    println!("initialized Boson project at {}", paths.root.display());
    println!("created {}", paths.manifest.display());
    println!("created {}", paths.db_path.display());
    println!("created {}", paths.secret_key_path.display());
    Ok(())
}

async fn serve_cmd(args: ServeArgs) -> anyhow::Result<()> {
    let addr = SocketAddr::new(args.host, args.port);
    let mode = ServerMode::Embedded;
    let paths = project::discover(Some(&args.project_dir))?;
    server::run(addr, mode, !args.no_open, paths).await
}

async fn dev_cmd(args: DevArgs) -> anyhow::Result<()> {
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

async fn run_cmd(args: RunArgs) -> anyhow::Result<()> {
    let paths = project::discover(Some(&args.project_dir))?;
    let snapshot = project::load_snapshot(&paths)?;
    let store = Store::open(&paths.db_path)?;
    store.replace_snapshot(&snapshot)?;
    let secrets = SecretManager::new(store.clone(), &paths.secret_key_path)?;

    let ctx = RunContext {
        store: store.clone(),
        secrets,
        registry: RunRegistry::new(),
        project_root: paths.root.clone(),
    };
    let run_id = uuid_like();
    let outcome = run_request(
        ctx,
        run_id,
        args.request_id,
        RunRequestInput {
            environment_id: args.environment,
        },
    )
    .await
    .context("run failed")?;

    print_run_outcome(&outcome, args.raw);
    Ok(())
}

fn uuid_like() -> String {
    use chrono::Utc;
    use std::time::SystemTime;
    let micros = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_micros())
        .unwrap_or(0);
    format!("run_{}_{}", Utc::now().format("%Y%m%dT%H%M%S"), micros)
}

fn print_run_outcome(outcome: &crate::runner::RunOutcome, raw: bool) {
    let history = match &outcome.history {
        Some(history) => history,
        None => {
            println!(
                "run {} ended without history (status={})",
                outcome.run.id,
                run_status_label(&outcome.run.status)
            );
            return;
        }
    };

    println!(
        "{} {} -> {} ({} ms)",
        history.method,
        history.url,
        history
            .status
            .map(|s| s.to_string())
            .unwrap_or_else(|| "ERR".to_string()),
        history.duration_ms,
    );
    if let Some(err) = &history.error {
        println!("error: {err}");
    }
    println!();
    if let serde_json::Value::Object(map) = &history.response_headers {
        for (key, value) in map {
            println!("{key}: {}", value.as_str().unwrap_or_default());
        }
    }
    println!();
    if raw || history.response_body.len() <= 8 * 1024 {
        println!("{}", history.response_body);
    } else {
        println!(
            "{}\n... [truncated, {} bytes total; pass --raw for full body]",
            &history.response_body[..8 * 1024],
            history.response_body.len()
        );
    }
    if history.response_truncated {
        println!("(response body was truncated by server-side max_response_bytes)");
    }
}

fn run_status_label(status: &crate::db::RunStatus) -> &'static str {
    match status {
        crate::db::RunStatus::Pending => "pending",
        crate::db::RunStatus::Running => "running",
        crate::db::RunStatus::Completed => "completed",
        crate::db::RunStatus::Failed => "failed",
        crate::db::RunStatus::Canceled => "canceled",
    }
}

fn lint_cmd(args: LintArgs) -> anyhow::Result<()> {
    let paths = project::discover(Some(&args.project_dir))?;
    match project::load_snapshot(&paths) {
        Ok(snapshot) => {
            println!(
                "ok: project `{}` (schema v{}, {} environments, {} requests)",
                snapshot.manifest.name,
                snapshot.manifest.schema_version,
                snapshot.environments.len(),
                snapshot.requests.len()
            );
            Ok(())
        }
        Err(err) => {
            for cause in err.chain() {
                eprintln!("error: {cause}");
            }
            std::process::exit(1);
        }
    }
}

fn update_cmd(args: UpdateArgs) -> anyhow::Result<()> {
    let current = env!("CARGO_PKG_VERSION");
    let Some(repo) = args.repo else {
        println!("boson {current}");
        println!(
            "no update source configured. Set --repo <owner>/<repo> or BOSON_UPDATE_REPO=<owner>/<repo>."
        );
        return Ok(());
    };

    let (owner, name) = repo
        .split_once('/')
        .with_context(|| format!("--repo `{repo}` must be in the form `<owner>/<name>`"))?;

    let identifier = self_update::get_target();
    let asset_name = args
        .asset_name
        .unwrap_or_else(|| format!("boson-{identifier}.tar.gz"));

    let mut builder = self_update::backends::github::Update::configure();
    builder
        .repo_owner(owner)
        .repo_name(name)
        .bin_name("boson")
        .target(identifier)
        .identifier(&asset_name)
        .show_download_progress(true)
        .current_version(current);
    let updater = builder.build()?;

    if args.dry_run {
        let release = updater.get_latest_release()?;
        println!("current: {current}");
        println!(
            "latest:  {} (target asset: {})",
            release.version, asset_name
        );
        return Ok(());
    }

    let status = updater.update()?;
    println!("update status: {}", status.version());
    Ok(())
}
