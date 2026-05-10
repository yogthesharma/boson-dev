//! Build script.
//!
//! When the `embed-ui` feature is enabled (the default), this script ensures
//! `web/dist` exists by running `pnpm install` (if needed) and `pnpm build` in
//! the `web/` directory. The output is then embedded into the binary by
//! `rust-embed` (see `src/assets.rs`).
//!
//! For fast Rust-only iteration, build with `--no-default-features` to skip
//! this entirely.

use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{bail, Context, Result};

fn main() -> Result<()> {
    // Only do work when the UI is being embedded.
    let embed_ui = std::env::var_os("CARGO_FEATURE_EMBED_UI").is_some();
    if !embed_ui {
        // Still emit at least one rerun-if instruction so cargo treats this
        // build script as cacheable.
        println!("cargo:rerun-if-changed=build.rs");
        return Ok(());
    }

    let manifest_dir =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").context("CARGO_MANIFEST_DIR not set")?);
    let web_dir = manifest_dir.join("web");

    // Tell cargo to rerun this script when the web sources change.
    rerun_if_dir_changed(&web_dir.join("src"));
    rerun_if_path_changed(&web_dir.join("index.html"));
    rerun_if_path_changed(&web_dir.join("vite.config.ts"));
    rerun_if_path_changed(&web_dir.join("package.json"));
    rerun_if_path_changed(&web_dir.join("pnpm-lock.yaml"));
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-env-changed=BOSON_SKIP_WEB_BUILD");

    // Allow opting out (CI, partial workspaces, etc.) by setting an env var.
    if std::env::var_os("BOSON_SKIP_WEB_BUILD").is_some() {
        println!(
            "cargo:warning=BOSON_SKIP_WEB_BUILD set; not running pnpm build (web/dist must exist)"
        );
        ensure_dist_exists(&web_dir)?;
        return Ok(());
    }

    if !web_dir.join("package.json").exists() {
        bail!(
            "embed-ui feature is enabled but {} is missing",
            web_dir.join("package.json").display()
        );
    }

    let pnpm = pnpm_command();

    if !web_dir.join("node_modules").exists() {
        println!("cargo:warning=running `pnpm install` in web/");
        run(&pnpm, &["install"], &web_dir).context("`pnpm install` failed")?;
    }

    println!("cargo:warning=running `pnpm build` in web/");
    run(&pnpm, &["build"], &web_dir).context("`pnpm build` failed")?;

    ensure_dist_exists(&web_dir)?;
    Ok(())
}

fn ensure_dist_exists(web_dir: &Path) -> Result<()> {
    let dist = web_dir.join("dist");
    if !dist.exists() {
        bail!(
            "expected web build output at {} but it does not exist",
            dist.display()
        );
    }
    if !dist.join("index.html").exists() {
        bail!(
            "{} is missing index.html (vite build did not complete?)",
            dist.display()
        );
    }
    Ok(())
}

fn pnpm_command() -> String {
    std::env::var("BOSON_PNPM").unwrap_or_else(|_| "pnpm".to_string())
}

fn run(program: &str, args: &[&str], cwd: &Path) -> Result<()> {
    let status = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .status()
        .with_context(|| format!("failed to spawn `{} {}`", program, args.join(" ")))?;
    if !status.success() {
        bail!("`{} {}` exited with {}", program, args.join(" "), status);
    }
    Ok(())
}

fn rerun_if_path_changed(path: &Path) {
    println!("cargo:rerun-if-changed={}", path.display());
}

fn rerun_if_dir_changed(dir: &Path) {
    if !dir.exists() {
        return;
    }
    println!("cargo:rerun-if-changed={}", dir.display());
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                rerun_if_dir_changed(&path);
            } else {
                rerun_if_path_changed(&path);
            }
        }
    }
}
