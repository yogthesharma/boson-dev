//! `boson update` — pull the latest GitHub release and replace the binary.

use anyhow::Context;

use super::args::UpdateArgs;

pub(super) fn update_cmd(args: UpdateArgs) -> anyhow::Result<()> {
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
