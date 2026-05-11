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

From inside the project (or set `BOSON_PROJECT_DIR` to its path):

```bash
boson serve
```

Open `http://127.0.0.1:8787` (or the host/port you set — see **Environment variables**).

### 4) Run a request from CLI

```bash
boson run hello
```

(`BOSON_PROJECT_DIR` applies here too if you are not `cd`'d into the project.)

If you hit setup issues, `boson doctor` reports missing tools, port conflicts, writable-path issues, and project validation errors with fix commands. For CI, use `boson doctor --strict` (exit non-zero on warnings) and/or `--json` for machine-readable output.

---

## What Boson Is

Boson treats API workflows like code:

- `boson.yml` + `boson/**/*.yml` are the source of truth
- project-local state lives in `.boson/` (SQLite + key file)
- **`boson serve`** runs the embedded UI + API (what release binaries ship)
- **`boson dev`** (Vite + HMR) exists only in **contributor** builds (`cargo build` / `cargo run --no-default-features` from this repo), not in normal release installs

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
| `boson serve`                | Run embedded UI + API (default install) |
| `boson run <request_id>`     | Execute one request                     |
| `boson lint` / `boson check` | Validate project YAML                   |
| `boson doctor`               | Diagnose local setup; add `--strict` / `--json` for CI and tooling |
| `boson update`               | Self-update from GitHub releases        |

Contributor builds from source may also expose **`boson dev`** (Vite + HMR against the repo `web/` tree).

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

In contributor **`boson dev`**, non-`/api/*` traffic is proxied to Vite. **`boson serve`** serves the embedded UI for `/` and API under `/api`.

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

Release-style binary (default features, includes **`boson serve`** only): use the command above.

Contributor binary (includes **`boson dev`** for Vite + HMR):

```bash
cargo build --no-default-features
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

- **`BOSON_PROJECT_DIR`** — default project directory for `serve`, `run`, `lint`, `doctor` when you omit `--project-dir`
- **`BOSON_PORT`** — default listen port for `serve` (and contributor `dev`) when you omit `--port`
- **`BOSON_VITE_PORT`** — contributor `dev` only: Vite port when omitted
- `RUST_LOG`
- `BOSON_SKIP_WEB_BUILD`
- `BOSON_PNPM`
- `BOSON_API_URL`
- `VITE_DEV_PORT`
- `BOSON_UPDATE_REPO`, `BOSON_UPDATE_ASSET`
- `BOSON_VERSION`, `BOSON_INSTALL_DIR`, `BOSON_INSTALL_REPO`

---

## Contributing

See **[`CONTRIBUTING.md`](CONTRIBUTING.md)**. Be kind and professional; this project follows the **[Contributor Covenant](CODE_OF_CONDUCT.md)**.

---

## License

This project is licensed under the **MIT License** — see [`LICENSE`](LICENSE).
