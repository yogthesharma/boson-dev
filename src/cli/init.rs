//! `boson init` — create a fresh project with sample files.

use crate::db::Store;
use crate::project;
use crate::secrets::SecretManager;

use super::args::InitArgs;

pub(super) fn init(args: InitArgs) -> anyhow::Result<()> {
    let paths = project::init(&args.dir, args.name, args.force)?;
    let snapshot = project::load_snapshot(&paths)?;
    let store = Store::open(&paths.db_path)?;
    store.replace_snapshot(&snapshot)?;
    SecretManager::new(store, &paths.secret_key_path)?;
    let root = paths.root.display();
    println!("initialized Boson project at {root}");
    println!();
    println!("Your collection (commit these):");
    for label in [
        paths.root.join("LLM.md"),
        paths.manifest.clone(),
        paths.boson_dir.join("environments.yml"),
        paths.boson_dir.join("requests.yml"),
    ] {
        println!("  {}", rel_under_root(&paths.root, &label));
    }
    println!();
    println!("Local workspace (gitignored — drafts, history, encrypted secrets):");
    println!("  .boson/");
    println!();
    println!("next steps:");
    println!("  cd {}", paths.root.display());
    println!("  boson doctor --project-dir .");
    println!("  boson serve --project-dir .   # UI bundled in the binary (use this after init)");
    if let Some(first) = snapshot.requests.first() {
        println!("  boson run {} --project-dir .", first.id);
    } else {
        println!("  boson run <request_id> --project-dir .");
    }
    println!();
    println!("optional (live UI / HMR — needs the Boson repo `web/` tree):");
    println!("  boson dev --project-dir . --web-dir /path/to/boson/web");
    println!();
    println!("example project flow (from a Boson git checkout):");
    println!("  just dev-example");
    println!();
    println!("tip: prefer `boson init my-api` so the project root is `my-api/` — avoid `my-api/boson/`");
    println!("      or you get paths like `boson/environments.yml` nested under a folder named `boson`.");
    Ok(())
}

fn rel_under_root(root: &std::path::Path, path: &std::path::Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .display()
        .to_string()
        .replace('\\', "/")
}
