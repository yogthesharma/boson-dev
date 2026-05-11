# Boson

Boson is a local-first, code-first API client for teams that want request collections in Git, not in a hosted workspace.

- YAML collections and environments in your repo
- Native binary with local browser UI + API server
- Encrypted local secrets, request history, and drafts
- No Boson cloud account required

## Install

### macOS / Linux (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/yogthesharma/boson-dev/main/install.sh | bash
```

Then verify:

```bash
boson --version
```

### Install options

```bash
# install a specific release
curl -fsSL https://raw.githubusercontent.com/yogthesharma/boson-dev/main/install.sh \
  | BOSON_VERSION=v0.1.1 bash

# install to a custom location
curl -fsSL https://raw.githubusercontent.com/yogthesharma/boson-dev/main/install.sh \
  | BOSON_INSTALL_DIR=/usr/local/bin bash
```

### Windows

Download the matching `.zip` from [Releases](https://github.com/yogthesharma/boson-dev/releases/latest), unzip, and add `boson.exe` to `PATH`.

---

## Quick Start

### 1) Initialize a project

```bash
boson init ./my-api --name "My API"
cd my-api
```

### 2) Run health checks

```bash
boson doctor --project-dir .
```

### 3) Start the app

```bash
boson dev --project-dir .
```

Open `http://127.0.0.1:8787`.

### 4) Run a request from CLI

```bash
boson run hello --project-dir .
```

If you hit setup issues, `boson doctor` reports missing tools, port conflicts, writable-path issues, and project validation errors with fix commands. For CI, use `boson doctor --strict` (exit non-zero on warnings) and/or `--json` for machine-readable output.

---

## What Boson Is

Boson treats API workflows like code:

- `boson.yml` + `boson/**/*.yml` are the source of truth
- project-local state lives in `.boson/` (SQLite + key file)
- `boson dev` runs Rust server + Vite proxy (HMR)
- `boson serve` runs production embedded UI

Commit YAML files, do not commit `.boson/`.

---

## Core Features

- Git-friendly YAML collections with include globs
- Environments with variable interpolation (`{{name}}`)
- Encrypted secrets (`{{secret:NAME}}`) stored locally
- HTTP execution with auth + JSON/form/multipart/text support
- Local API + modern React UI in one binary
- CLI commands for linting, running, troubleshooting, and updates

---

## CLI Reference

| Command                      | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| `boson init [dir]`           | Create a new Boson project              |
| `boson dev`                  | Dev mode (API + Vite proxy + HMR)       |
| `boson serve`                | Production mode (embedded UI)           |
| `boson run <request_id>`     | Execute one request                     |
| `boson lint` / `boson check` | Validate project YAML                   |
| `boson doctor`               | Diagnose local setup; add `--strict` / `--json` for CI and tooling |
| `boson update`               | Self-update from GitHub releases        |

---

## Project Format

### What lives on disk

**You edit and commit** — your API collection:

```text
my-api/
├── boson.yml              # manifest (name, includes, schema)
├── LLM.md                 # optional hints for you / coding agents
└── boson/
    ├── environments.yml   # envs + variables
    └── requests.yml       # requests (split across more files if you like)
```

**Boson keeps locally** (gitignored — not part of your “collection”):

- `.boson/` — SQLite + encryption key for drafts, history, and encrypted secrets. You normally never open these files by hand.

**Naming tip:** run `boson init my-api` so the project root is `my-api/`. Avoid `my-api/boson/` as the root, or every path starts with `boson/...` twice in conversation.

### YAML notes

- `schema_version: 2` in `boson.yml`
- `includes` supports glob patterns
- Include files may define `environments` and/or `requests`
- Request objects support method, url, headers, query, auth, body, and options

See `src/config/mod.rs` and `src/config/body.rs` for exact schema behavior.

---

## Local HTTP API

Boson UI communicates with local endpoints under `/api`.

Common endpoints:

- `GET /api/health`
- `GET /api/version`
- `GET /api/requests`
- `POST /api/requests/{request_id}/run`
- `GET /api/secrets`
- `POST /api/secrets/{name}`

In `boson dev`, non-`/api/*` traffic is proxied to Vite.

---

## Updates

```bash
boson update
boson update --check
boson update --yes
```

You can override release source with `--repo <owner>/<repo>` or `BOSON_UPDATE_REPO`.

---

## Development

### Build from source

Prerequisites:

- Rust (stable)
- Node 20+
- pnpm

```bash
git clone https://github.com/yogthesharma/boson-dev
cd boson-dev
pnpm install --dir web
cargo build --release
```

### Useful local commands

```bash
just dev-example
just doctor
cargo dev-example
```

Example workspace docs: `example/README.md`.

---

## Environment Variables

- `RUST_LOG`
- `BOSON_SKIP_WEB_BUILD`
- `BOSON_PNPM`
- `BOSON_API_URL`
- `VITE_DEV_PORT`
- `BOSON_UPDATE_REPO`, `BOSON_UPDATE_ASSET`
- `BOSON_VERSION`, `BOSON_INSTALL_DIR`, `BOSON_INSTALL_REPO`

---

## Contributing

Contributions are welcome.

1. Fork and create a feature branch.
2. Make focused changes with tests/checks.
3. Run local checks:

```bash
cargo check --no-default-features
just ci
```

4. Open a PR with a clear summary and test plan.

For release changes, follow `docs/release-verify-checklist.md`.

---

## License

MIT.
