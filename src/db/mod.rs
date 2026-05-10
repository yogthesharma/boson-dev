//! SQLite-backed local state. Holds a normalized projection of the YAML
//! project plus runtime state: drafts, in-flight runs, request history, and
//! encrypted secrets.
//!
//! YAML files remain the source of truth; this DB is a safety + speed layer
//! that the UI talks to directly. The watcher refreshes the projection on
//! every YAML change.

mod migrations;
mod rows;
mod store;
mod types;

pub use store::Store;
pub use types::{Draft, NewHistory, ProjectView, ResponseHistory, Run, RunStatus};
