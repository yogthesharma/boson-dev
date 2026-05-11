//! Bring up a Vite dev server (used in `boson dev`) and wait until it's
//! accepting connections.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::process::Stdio;

use anyhow::Context;
use tokio::process::{Child, Command};
use tracing::info;

pub(super) async fn spawn_vite_dev(web_dir: &PathBuf, port: u16) -> anyhow::Result<Child> {
    if !web_dir.join("package.json").exists() {
        anyhow::bail!(
            "no package.json found in {}\n\
             hint: use `boson serve` for the embedded UI, or pass `--web-dir` to a Vite project",
            web_dir.display()
        );
    }

    if !web_dir.join("node_modules").exists() {
        info!(dir = %web_dir.display(), "installing web dependencies (pnpm install)");
        let status = Command::new("pnpm")
            .arg("install")
            .current_dir(web_dir)
            .status()
            .await
            .context("failed to run `pnpm install`")?;
        if !status.success() {
            anyhow::bail!("`pnpm install` exited with status {status}");
        }
    }

    info!(port, dir = %web_dir.display(), "spawning `pnpm dev`");
    let child = Command::new("pnpm")
        .args(["dev", "--port", &port.to_string()])
        .env("VITE_DEV_PORT", port.to_string())
        .current_dir(web_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .context("failed to spawn `pnpm dev`")?;

    Ok(child)
}

pub(super) async fn wait_for_vite(upstream: SocketAddr) -> anyhow::Result<()> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
    loop {
        if tokio::net::TcpStream::connect(upstream).await.is_ok() {
            info!(%upstream, "vite dev server is ready");
            return Ok(());
        }
        if std::time::Instant::now() >= deadline {
            anyhow::bail!("vite dev server at {upstream} did not become ready in 30s");
        }
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
}
