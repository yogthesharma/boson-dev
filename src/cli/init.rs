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
    println!("created {}", paths.manifest.display());
    println!("created {}", paths.db_path.display());
    println!("created {}", paths.secret_key_path.display());
    Ok(())
}
