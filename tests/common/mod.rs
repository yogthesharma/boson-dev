//! Shared helpers for integration tests. Lives under a subdirectory so
//! Cargo doesn't treat it as a standalone test crate.

use boson::db::Store;
use boson::project::{self, ProjectPaths};
use tempfile::TempDir;

/// Initialise a fresh Boson project in a tempdir and load it into SQLite.
/// Returns the `ProjectPaths` for the caller to interact with.
#[allow(dead_code)]
pub fn init_project(tmp: &TempDir) -> ProjectPaths {
    let paths = project::init(tmp.path(), Some("test".to_string()), false).expect("init project");
    let snapshot = project::load_snapshot(&paths).expect("snapshot");
    let store = Store::open(&paths.db_path).expect("store");
    store.replace_snapshot(&snapshot).expect("replace snapshot");
    paths
}
