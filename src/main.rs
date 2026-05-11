use boson::cli;
use clap::Parser;
use std::io::{self, IsTerminal, Write};
use std::path::Path;

#[tokio::main]
async fn main() {
    init_tracing();
    let cli = cli::Cli::parse();
    if let Err(err) = cli.run().await {
        report_error_with_hints(&err);
        std::process::exit(1);
    }
}

fn init_tracing() {
    use tracing_subscriber::{fmt, EnvFilter};

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,boson=debug,tower_http=info"));

    fmt()
        .with_env_filter(filter)
        .with_target(false)
        .compact()
        .init();
}

fn report_error_with_hints(err: &anyhow::Error) {
    eprintln!("error: {err:#}");
    let combined = format!("{err:#}").to_ascii_lowercase();
    maybe_offer_project_init(&combined);
    let hints = build_hints(&combined);
    if !hints.is_empty() {
        eprintln!();
        eprintln!("help:");
        for hint in hints {
            eprintln!("  - {hint}");
        }
    }
}

fn maybe_offer_project_init(message: &str) {
    if !message.contains("no boson.yml found") {
        return;
    }
    let stdin = io::stdin();
    if !stdin.is_terminal() {
        return;
    }

    eprintln!();
    eprintln!("No Boson project was found in this directory tree.");
    eprintln!("Choose one:");
    eprintln!("  [1] Initialize a project here (`boson init .`)");
    eprintln!("  [2] Keep current files and run with `--project-dir <path>`");
    eprintln!("  [3] Cancel");
    eprint!("Selection [1/2/3] (default 2): ");
    let _ = io::stderr().flush();

    let mut answer = String::new();
    if stdin.read_line(&mut answer).is_err() {
        return;
    }
    let answer = answer.trim();
    if answer == "1" {
        if Path::new("boson.yml").exists() {
            eprintln!("`boson.yml` already exists in the current directory; skipping init.");
            return;
        }
        eprintln!("Run this command next:");
        eprintln!("  boson init . && boson doctor --project-dir . && boson dev --project-dir .");
    } else if answer == "2" || answer.is_empty() {
        eprintln!("Run this command next:");
        eprintln!("  boson doctor --project-dir <path>");
    } else {
        eprintln!("Cancelled.");
    }
}

fn build_hints(message: &str) -> Vec<String> {
    let mut hints = Vec::new();

    if message.contains("failed to bind")
        || message.contains("address already in use")
        || message.contains("in use")
    {
        hints.push("port is likely occupied; inspect listeners with `lsof -nP -iTCP:8787 -sTCP:LISTEN` (and similarly for 5173/4321)".to_string());
        hints.push("run on a different port: `boson dev --port 9000 --vite-port 5174`".to_string());
    }

    if message.contains("failed to spawn `pnpm dev`")
        || message.contains("failed to run `pnpm install`")
        || (message.contains("pnpm") && message.contains("not found"))
    {
        hints.push("pnpm is missing or unavailable; install it with `npm install -g pnpm`".to_string());
        hints.push("then install web deps and retry: `pnpm --dir web install --frozen-lockfile && boson dev`".to_string());
    }

    if message.contains("no boson.yml found")
        || message.contains("does not exist")
        || message.contains("failed to resolve")
    {
        hints.push(
            "project path looks invalid; pass a valid project dir: `boson dev --project-dir <path>`"
                .to_string(),
        );
        hints.push("or initialize a new project first: `boson init <path>`".to_string());
    }

    if message.contains("failed to fetch the latest release")
        || message.contains("failed to install v")
        || message.contains("missing release tag")
        || message.contains("invalid release tag")
        || message.contains("404")
    {
        hints.push("release artifact/tag may be missing; verify on GitHub releases and push the tag first (`git push origin <tag>`)".to_string());
        hints.push("test update wiring with `boson update --check` before running a full install".to_string());
    }

    hints
}
