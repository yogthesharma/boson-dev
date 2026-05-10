//! Execute a single request against an HTTP endpoint.
//!
//! Inputs come from the SQLite-projected request (drafts override canonical),
//! the selected environment, and the encrypted secret store. Output is a
//! `ResponseHistory` row stored alongside a `Run` row that tracks status and
//! supports cancellation through a `CancellationToken`.

mod http;
mod orchestrator;
mod registry;
mod resolve;

pub use orchestrator::{run_request, RunContext, RunOutcome, RunRequestInput};
pub use registry::RunRegistry;
