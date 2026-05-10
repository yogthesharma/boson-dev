//! `boson update` — fetch the latest release from GitHub and replace this
//! binary in place.
//!
//! The repository to check is, in order of precedence:
//!   1. `--repo <owner>/<name>` on the command line
//!   2. The `BOSON_UPDATE_REPO` environment variable
//!   3. The `BOSON_UPDATE_REPO` build-time variable (baked at compile time)
//!   4. The hard-coded fallback for the upstream project
//!
//! The asset on each release is expected to be named `boson-<target>.tar.gz`
//! (or `boson-<target>.zip` on Windows), where `<target>` is the rustc target
//! triple — matching the layout published by `.github/workflows/release.yml`.

use std::io::{self, IsTerminal, Write};

use anyhow::{anyhow, Context};

use super::args::UpdateArgs;

/// The GitHub `<owner>/<name>` slug Boson asks about by default.
const DEFAULT_REPO: &str = match option_env!("BOSON_UPDATE_REPO") {
    Some(repo) => repo,
    None => "yogthesharma/boson-dev",
};

pub(super) fn update_cmd(args: UpdateArgs) -> anyhow::Result<()> {
    let current = env!("CARGO_PKG_VERSION");
    let target = self_update::get_target();

    let repo = args.repo.unwrap_or_else(|| DEFAULT_REPO.to_string());
    let (owner, name) = repo
        .split_once('/')
        .with_context(|| format!("--repo `{repo}` must be in the form `<owner>/<name>`"))?;

    let asset_name = args
        .asset_name
        .unwrap_or_else(|| default_asset_name(target));

    println!("boson {current} ({target})");
    println!("checking https://github.com/{repo} for newer releases...");

    let mut builder = self_update::backends::github::Update::configure();
    builder
        .repo_owner(owner)
        .repo_name(name)
        .bin_name("boson")
        .target(target)
        .identifier(&asset_name)
        .show_download_progress(true)
        .current_version(current)
        .no_confirm(true);
    let updater = builder
        .build()
        .with_context(|| format!("failed to configure updater for {repo}"))?;

    let release = updater
        .get_latest_release()
        .with_context(|| format!("failed to fetch the latest release from {repo}"))?;

    let latest = release.version.trim_start_matches('v');
    let is_newer = self_update::version::bump_is_greater(current, latest).unwrap_or(false);

    println!();
    println!("  current : v{current}");
    println!("  latest  : v{latest}");

    if !is_newer {
        println!();
        println!("You're already on the latest version.");
        return Ok(());
    }

    if !release.name.is_empty() && release.name.trim_start_matches('v') != latest {
        println!("  title   : {}", release.name);
    }
    if let Some(asset) = release.asset_for(target, Some(&asset_name)) {
        println!("  asset   : {}", asset.name);
    }

    if let Some(notes) = release.body.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        println!();
        println!("release notes:");
        for line in notes.lines().take(20) {
            println!("  {line}");
        }
        if notes.lines().count() > 20 {
            println!("  …");
        }
    }
    println!();

    if args.check {
        println!(
            "run `boson update` (or `boson update --yes`) to download and install v{latest}."
        );
        return Ok(());
    }

    if !args.yes && !confirm(&format!("Download and install v{latest}?"))? {
        println!("aborted.");
        return Ok(());
    }

    println!();
    println!("downloading {asset_name}...");
    let status = updater
        .update()
        .with_context(|| format!("failed to install v{latest}"))?;
    println!();
    println!("Updated to {}. Run `boson --version` to verify.", status.version());
    Ok(())
}

fn default_asset_name(target: &str) -> String {
    if target.contains("windows") {
        format!("boson-{target}.zip")
    } else {
        format!("boson-{target}.tar.gz")
    }
}

fn confirm(prompt: &str) -> anyhow::Result<bool> {
    let stdin = io::stdin();
    if !stdin.is_terminal() {
        return Err(anyhow!(
            "stdin is not a terminal; pass `--yes` to confirm non-interactively"
        ));
    }
    print!("{prompt} [Y/n] ");
    io::stdout().flush().ok();
    let mut answer = String::new();
    stdin
        .read_line(&mut answer)
        .context("failed to read confirmation from stdin")?;
    let answer = answer.trim().to_ascii_lowercase();
    Ok(matches!(answer.as_str(), "" | "y" | "yes"))
}
