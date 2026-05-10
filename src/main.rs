use boson::cli;
use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();
    let cli = cli::Cli::parse();
    cli.run().await
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
