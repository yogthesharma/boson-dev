//! Library surface for the `boson` binary. Splitting the modules out lets
//! integration tests in `tests/` exercise project loading, the SQLite store,
//! the runner, and secrets without spawning a subprocess.

pub mod assets;
pub mod cli;
pub mod config;
pub mod db;
pub mod project;
pub mod proxy;
pub mod runner;
pub mod secrets;
pub mod server;
pub mod watcher;
