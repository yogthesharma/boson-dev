set shell := ["bash", "-cu"]

# Default target: list all recipes.
_default:
    @just --list

# Format Rust + check for drift.
fmt:
    cargo fmt

fmt-check:
    cargo fmt --check

# Type-check Rust without rebuilding the embedded UI.
check:
    cargo check --no-default-features

# Type-check the embedded build (slow; rebuilds web/dist).
check-full:
    cargo check

# Run all integration tests with the lighter (no embed) feature set.
test:
    cargo test --no-default-features

# Strict clippy as we run in CI; treat warnings as errors.
lint-rs:
    cargo clippy --no-default-features --all-targets -- -D warnings

# Static analysis for the web app.
lint-web:
    pnpm -C web typecheck

# All Rust + web checks in one run.
ci:
    just fmt-check
    just lint-rs
    just test
    just lint-web

# Build a debug binary that uses Vite dev mode (skip embedding).
build-debug:
    cargo build --no-default-features

# Build the production single-binary (runs `pnpm build` via build.rs).
build-release:
    cargo build --release

# Run the dev server against ./example-api (init it first if needed).
dev project_dir="example-api":
    cargo run --no-default-features -- dev --project-dir {{project_dir}}

# Initialise a fresh demo project under example-api/.
demo:
    cargo run --no-default-features -- init example-api --name Example --force

# Validate a project's YAML.
project-lint project_dir="example-api":
    cargo run --no-default-features -- lint --project-dir {{project_dir}}

# Run a single request from the CLI.
request id project_dir="example-api":
    cargo run --no-default-features -- run --project-dir {{project_dir}} {{id}}
