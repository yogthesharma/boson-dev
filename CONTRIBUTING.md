# Contributing to Boson

Thanks for helping improve Boson. Please read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before participating.

## Ways to contribute

- Report bugs or suggest features ([issues](https://github.com/yogthesharma/boson-dev/issues))
- Improve docs, examples, or error messages
- Submit fixes or small features via pull request

## Development setup

Prerequisites: **Rust** (stable), **Node 20+**, **pnpm**.

```bash
git clone https://github.com/yogthesharma/boson-dev.git
cd boson-dev
pnpm install --dir web
cargo check --no-default-features
```

- Full UI embed build: `cargo build --release` (runs `pnpm build` via `build.rs`).
- Rust-only iteration: `cargo build --no-default-features` (skips embedding step).

## Checks before you open a PR

```bash
just ci
```

Or manually:

```bash
cargo check --no-default-features
cargo fmt
cargo clippy --no-default-features --all-targets -- -D warnings
cargo test --no-default-features
pnpm -C web typecheck
```

## Pull requests

Use the PR template. Keep changes focused, describe **what** and **why**, and note how you tested.

## Releases

Maintainers: follow [`docs/release-verify-checklist.md`](docs/release-verify-checklist.md) when cutting releases.

## Questions

Open a [discussion](https://github.com/yogthesharma/boson-dev/discussions) or issue if something is unclear.
