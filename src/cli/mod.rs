//! `boson` CLI surface. The `Cli` struct is parsed in `main.rs`; each
//! command is implemented in its own submodule for clarity.

mod args;
mod doctor;
mod init;
mod lint;
mod run;
mod serve;
mod update;

pub use args::{DevArgs, DoctorArgs, InitArgs, LintArgs, RunArgs, ServeArgs, UpdateArgs};

use clap::{Parser, Subcommand};

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

    /// Diagnose local setup: tools, ports, writable dirs, and project validity (`--strict`, `--json`).
    Doctor(DoctorArgs),

    /// Update the boson binary in place by checking the configured release feed.
    Update(UpdateArgs),
}

impl Cli {
    pub async fn run(self) -> anyhow::Result<()> {
        match self.command {
            Command::Init(args) => init::init(args),
            Command::Serve(args) => serve::serve_cmd(args).await,
            Command::Dev(args) => serve::dev_cmd(args).await,
            Command::Run(args) => run::run_cmd(args).await,
            Command::Lint(args) | Command::Check(args) => lint::lint_cmd(args),
            Command::Doctor(args) => doctor::doctor_cmd(args),
            Command::Update(args) => update::update_cmd(args),
        }
    }
}
