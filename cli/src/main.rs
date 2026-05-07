use std::path::PathBuf;

use anyhow::Result;
use clap::Parser;

mod commands;
mod schema;

#[derive(Parser)]
#[command(
    name = "boson",
    version,
    about = "Boson CLI — sync your boson.yml with the Boson cloud."
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(clap::Subcommand)]
enum Command {
    /// Scaffold a boson.yml in the current directory.
    Init {
        /// Where to write the file. Defaults to ./boson.yml.
        #[arg(short, long, default_value = "boson.yml")]
        path: PathBuf,
    },
    /// Validate boson.yml and push it to the Boson server (canonical).
    Push {
        /// Path to your boson.yml.
        #[arg(short, long, default_value = "boson.yml")]
        file: PathBuf,
        /// Override the server base URL (default: $BOSON_SERVER_URL or http://localhost:3001).
        #[arg(long)]
        server: Option<String>,
        /// Validate locally without sending the payload.
        #[arg(long)]
        dry_run: bool,
    },
    /// Save an API token to ~/.config/boson/auth.json (from email/password login).
    Login {
        #[arg(long)]
        email: String,
        #[arg(long)]
        password: String,
        #[arg(long)]
        server: Option<String>,
    },
    /// Create an account and save the JWT to ~/.config/boson/auth.json.
    Register {
        #[arg(long)]
        email: String,
        #[arg(long)]
        password: String,
        #[arg(long)]
        server: Option<String>,
    },
    /// Watch boson.yml and sync a per-user draft to the server (`POST /v1/drafts`).
    Dev {
        #[arg(short, long, default_value = "boson.yml")]
        file: PathBuf,
        #[arg(long)]
        server: Option<String>,
        /// Call `DELETE /v1/drafts` and exit (no file watch).
        #[arg(long)]
        reset: bool,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Init { path } => commands::init::run(&path),
        Command::Push {
            file,
            server,
            dry_run,
        } => commands::push::run(&file, server.as_deref(), dry_run),
        Command::Login {
            email,
            password,
            server,
        } => commands::login::run(&email, &password, server.as_deref()),
        Command::Register {
            email,
            password,
            server,
        } => commands::register::run(&email, &password, server.as_deref()),
        Command::Dev {
            file,
            server,
            reset,
        } => commands::dev::run(&file, server.as_deref(), reset),
    }
}
