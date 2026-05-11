use boson::cli;
use clap::Parser;

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
    let hints = build_hints(&combined);
    if !hints.is_empty() {
        eprintln!();
        eprintln!("help:");
        for hint in hints {
            eprintln!("  - {hint}");
        }
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
