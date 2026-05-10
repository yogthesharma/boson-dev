//! `boson lint` / `boson check` — validate YAML files and print a summary.

use crate::project;

use super::args::LintArgs;

pub(super) fn lint_cmd(args: LintArgs) -> anyhow::Result<()> {
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
