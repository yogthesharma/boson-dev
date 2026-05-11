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
    println!("initialized Boson project at {}", paths.root.display());
    println!("created {}", paths.root.join("LLM.md").display());
    println!("created {}", paths.manifest.display());
    println!("created {}", paths.db_path.display());
    println!("created {}", paths.secret_key_path.display());
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
    Ok(())
}
