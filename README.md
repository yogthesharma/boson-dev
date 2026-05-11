# Boson

**Boson** is a **code-first, local-only** HTTP client: your API collection lives in **plain YAML** in the repo, you run a **small native app** on your machine, and you get a **Postman/Bruno-style** UI for sending requests, environments, and history—**no cloud account, no hosted sync, and no separate “Boson server” in another datacenter**.

> **Why Boson?**  
> Treat collections like code: review them in PRs, branch them, and keep secrets out of git. The binary loads your YAML, runs requests (via [`reqwest`](https://github.com/seanmonstar/reqwest)), and stores **drafts and response history in a local SQLite file** so the UI stays fast and team-friendly without a SaaS.

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Install](#install)
- [Updates](#updates)
- [Quick start](#quick-start)
- [Development workflows](#development-workflows)
- [Project layout (on disk)](#project-layout-on-disk)
- [YAML project format](#yaml-project-format)
- [Variables and secrets](#variables-and-secrets)
- [CLI reference](#cli-reference)
- [HTTP API (local)](#http-api-local)
- [Environment variables](#environment-variables)
- [Example workspace](#example-workspace)
- [License](#license)

---

## Features

- **Git-friendly collections** — Requests and environments are **YAML** you can split across files; `boson.yml` controls **include globs** (e.g. `boson/requests/**/*.yml`).
- **Environments** — Per-environment **variables** (e.g. `base_url`) for `{{placeholders}}` in URL, headers, query, and body.
- **Secrets (local)** — Store values like API keys **encrypted in SQLite** (per-project key), referenced in YAML as `{{secret:NAME}}` so they never land in the committed files.
- **Execution** — HTTP methods, JSON / form / raw / **multipart** bodies, optional **Bearer / Basic / API key** auth (declared in YAML).
- **Runner + UI** — Same **`boson`** binary serves the **React** UI (embedded in release builds) and exposes a **`/api/*`** surface backed by Rust + SQLite.
- **CLI** — **`boson run <request-id>`** runs a request with resolved env/secrets and prints the response (great for scripts and CI).
- **Lint** — **`boson lint`** validates YAML before you push.

---

## How it works

1. You maintain **`boson.yml`** and included YAML files under **`boson/`** — this is the **source of truth** (commit these).
2. On load, Boson **merges** includes into a project snapshot and mirrors metadata into **`.boson/state.db`** for drafts, history, and encrypted secrets.
3. **`boson serve`** or **`boson dev`** binds **loopback** (default `127.0.0.1:8787`), serves **`/api/*`** from Rust, and serves the **SPA** (embedded static assets or proxied Vite in dev).

There is **no requirement for any Boson-hosted backend**. The only “server” involved is the **local process** inside the binary talking to your filesystem and SQLite—similar in spirit to running a local API tool, not renting a cloud collection service.

```text
  ┌──────────────┐     HTTP (loopback)      ┌─────────────────────────────┐
  │  Web UI      │  ◄──────────────────►  │  boson (Axum)              │
  │  (Vite/React)│      /api/*            │  · YAML load / save         │
  └──────────────┘                        │  · reqwest HTTP execution   │
        │                                 │  · SQLite (history, etc.)  │
        │  (dev: optional proxy)          └──────────────┬──────────────┘
        │                                                │
        ▼                                                ▼
  optional: pnpm dev                         .boson/state.db + your repo YAML
  → proxies /api to boson
```

---

## Install

### Quick install (macOS & Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/yogthesharma/boson-dev/main/install.sh | bash
```

This downloads the right binary for your platform from the [latest GitHub release](https://github.com/yogthesharma/boson-dev/releases/latest), verifies its checksum, and drops it at **`~/.local/bin/boson`**. If that directory isn't on your `PATH` yet, the script tells you the exact line to add to your shell rc.

**Pinning or customising:**

```bash
# install a specific version
curl -fsSL https://raw.githubusercontent.com/yogthesharma/boson-dev/main/install.sh \
  | BOSON_VERSION=v0.1.0 bash

# install somewhere on $PATH
curl -fsSL https://raw.githubusercontent.com/yogthesharma/boson-dev/main/install.sh \
  | BOSON_INSTALL_DIR=/usr/local/bin bash
```

### Windows

Grab the matching `.zip` from the [releases page](https://github.com/yogthesharma/boson-dev/releases/latest), unzip it, and put `boson.exe` anywhere on your `PATH`.

### Build from source

**Prerequisites**

- **Rust** (current stable; nightly is fine)
- **Node 20+** and **pnpm** (for building the web UI; not needed to *run* a release binary that already embeds the UI)

```bash
git clone https://github.com/yogthesharma/boson-dev boson
cd boson
pnpm install --dir web
cargo build --release
```

The binary is at `target/release/boson`.

- Use **`cargo build --no-default-features`** to skip the `pnpm build` step in `build.rs` when you are only iterating on Rust.
- Set **`BOSON_SKIP_WEB_BUILD=1`** during `cargo build` if you already have `web/dist` and want to skip the UI build step (see [Environment variables](#environment-variables)).

---

## Updates

Boson is its own updater. Once installed, ask for the latest release:

```bash
boson update           # show current vs latest, prompt, then install
boson update --check   # just tell me what's available, don't install
boson update --yes     # install non-interactively (good for scripts)
```

By default the command checks `yogthesharma/boson-dev` on GitHub. Override the source for forks or private mirrors:

```bash
boson update --repo my-org/boson-fork
# or persist it:
export BOSON_UPDATE_REPO=my-org/boson-fork
```

`boson update` reuses the same release artifacts as `install.sh`, so whichever you used to get on the train, the other one will keep you moving.

---

## Quick start

### 1. Create a project

```bash
cargo run --no-default-features -- init ./my-api --name "My API"
```

This creates:

```text
my-api/
├── boson.yml                 # manifest: name, schema_version, includes
├── boson/
│   ├── environments.yml      # environment variables
│   └── requests.yml          # requests (or use boson/requests/*.yml)
└── .boson/
    ├── state.db              # local state (history, drafts, secrets) — gitignore
    └── key.bin               # per-project secret encryption key — gitignore
```

**Commit** `boson.yml` and `boson/**/*.yml`. **Do not commit** `.boson/` (handled by `.gitignore` from `init`).

### 2. Run the app (development with HMR)

From the repo root, pointing at your project directory:

```bash
cargo run --no-default-features -- dev --project-dir ./my-api
```

This typically:

1. Starts the **Axum** server on **`http://127.0.0.1:8787`** (configurable).
2. Runs **`pnpm dev`** in **`web/`** (Vite on **`127.0.0.1:5173`** by default).
3. **Reverse-proxies** non-`/api/*` traffic (including **HMR WebSocket**) to Vite so editing React files hot-reloads.

Then open **`http://127.0.0.1:8787`** in the browser.

**Useful flags:**

```bash
cargo run --no-default-features -- dev --project-dir ./my-api --port 9000 --vite-port 5174
cargo run --no-default-features -- dev --project-dir ./my-api --no-spawn-vite   # you run Vite yourself
cargo run --no-default-features -- dev --project-dir ./my-api --no-open
```

### 3. Run without opening the UI

Execute a request **by id** (prints to stdout):

```bash
cargo run --no-default-features -- run hello --project-dir ./my-api
```

---

## Development workflows

There are **two** common ways to hack on the UI:

| Workflow | You open | Notes |
|----------|----------|--------|
| **`boson dev`** | `http://127.0.0.1:8787` (default) | Rust serves `/api/*` and proxies everything else to Vite + HMR. Best **full-stack** dev. |
| **`pnpm dev` only** (in `web/`) | `http://127.0.0.1:5173` | Vite dev server; **`/api/*` is proxied** to a **separately running** `boson serve` (default **`http://127.0.0.1:8787`**). Override with **`BOSON_API_URL`**. Fast iteration when you mostly touch React. |

Example for workflow 2:

```bash
# terminal A — API + SQLite backing the UI
cargo run --no-default-features -- serve --project-dir ./my-api

# terminal B — Vite (proxies /api → boson)
cd web && BOSON_API_URL=http://127.0.0.1:8787 pnpm dev
```

See comments in [`web/vite.config.ts`](web/vite.config.ts) for ports and proxy behavior.

---

## Project layout (on disk)

Repository layout (high level):

```text
boson/
├── Cargo.toml
├── build.rs                  # optional `pnpm build` in web/ when embedding UI
├── src/
│   ├── main.rs               # tracing + clap entrypoint
│   ├── cli/                  # init, serve, dev, run, lint, update
│   ├── config/               # YAML schema (requests, auth, body, …)
│   ├── db/                   # SQLite store + migrations
│   ├── project.rs            # discovery, load/save, glob includes
│   ├── runner/               # HTTP execution + variable resolution
│   ├── server/               # Axum app, /api routes, static UI / Vite proxy
│   ├── proxy.rs              # reverse proxy to Vite in dev
│   └── assets.rs             # rust-embed production assets
└── web/                      # Vite + React + TypeScript client
    ├── package.json
    ├── vite.config.ts
    └── src/
```

---

## YAML project format

- **`schema_version: 2`** in `boson.yml` (v1 files are rejected with a clear error).
- **`includes`** — list of **glob patterns** (relative to project root) for extra YAML. Defaults include `boson/environments.yml`, `boson/requests.yml`, and `boson/**` trees.
- **Include files** may define **`environments:`** and/or **`requests:`** (both optional in a file so you can split concerns).

**Request fields** (see [`src/config/mod.rs`](src/config/mod.rs)):

| Field | Purpose |
|--------|---------|
| `id` | Stable id for CLI and API (e.g. `hello`) |
| `name` | Human label in the UI |
| `folder` | Optional `Group/Sub` path for sidebar grouping |
| `method` | HTTP method (default `GET`) |
| `url` | URL with `{{variable}}` support |
| `headers` | String map |
| `query` | String map |
| `auth` | Optional structured auth (see below) |
| `body` | None, string, or tagged `json` / `form` / `multipart` / `text` |
| `options` | `timeout_ms`, redirects, `max_response_bytes`, cookies, etc. |

**Auth** (`auth`, tag `kind` — `bearer`, `basic`, `api_key`; `oauth2` is reserved / not fully implemented in the runner).

**Body** — either a **legacy string** for raw text, or an object with `kind: json` (and `value`) / `form` / `multipart` / `text` as implemented in [`src/config/body.rs`](src/config/body.rs).

---

## Variables and secrets

- **Environment variables** — In `environments.yml` (or included files), each environment has a `variables` map. In request fields, use **`{{name}}`** to substitute.
- **Secrets** — In YAML, reference **`{{secret:NAME}}`**. Values are stored **encrypted** in **`.boson/state.db`**; the API/CLI can set them without writing plaintext to disk in your repo.
- **Host / process env** — The resolver can also treat some references as **host environment** where applicable (useful for local-only values); see the implementation in [`src/runner/resolve.rs`](src/runner/resolve.rs) for exact behavior.

---

## CLI reference

| Command | Purpose |
|---------|---------|
| **`boson init [dir]`** | Create `boson.yml`, `boson/`, `.boson/`, seed SQLite + keys |
| **`boson dev`** | Dev server: API + **spawn Vite** + proxy (HMR) |
| **`boson serve`** | **Production** mode: serve **embedded** UI from the binary + API |
| **`boson run <request_id>`** | Run one request; optional `--environment`, `--raw` |
| **`boson lint` / `boson check`** | Validate YAML |
| **`boson doctor`** | Diagnose local setup (tools, ports, writable dirs, project health) |
| **`boson update`** | Self-update from GitHub releases (`--check`, `--yes`, `--repo <owner>/<name>`) |

Global defaults: `--project-dir` usually defaults to **`.`**; server bind defaults to **`127.0.0.1:8787`**.

If local dev fails, run:

```bash
boson doctor --project-dir .
```

---

## HTTP API (local)

All JSON REST routes are **on the same origin** as the UI in normal use, under **`/api`**. The web app talks to these endpoints; you can also use them for automation on loopback.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/version` | Version info |
| `GET` | `/api/project` | Project metadata |
| `GET` | `/api/environments` | Environments from YAML |
| `GET` | `/api/requests` | Merged requests |
| `GET` | `/api/drafts` | Draft state |
| `POST` / `DELETE` | `/api/drafts/{request_id}` | Upsert / delete draft |
| `POST` | `/api/drafts/{request_id}/save` | Persist draft to YAML |
| `GET` / `DELETE` | `/api/history` | List / clear history |
| `DELETE` | `/api/history/{id}` | Delete one history row |
| `GET` | `/api/runs` | List runs |
| `GET` | `/api/runs/{run_id}` | Run detail |
| `POST` | `/api/runs/{run_id}/cancel` | Cancel a run |
| `POST` | `/api/requests/{request_id}/run` | Execute a request from the UI |
| `GET` | `/api/secrets` | List secret **names** (not values) |
| `POST` / `DELETE` | `/api/secrets/{name}` | Set / remove a secret value |

Non-`/api/*` requests are handled by the **UI** (embedded files in release, or **Vite proxy** in `boson dev`).

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| **`RUST_LOG`** | Runtime | e.g. `RUST_LOG=boson=debug,tower_http=info` for tracing |
| **`BOSON_SKIP_WEB_BUILD`** | `cargo build` | Skip `pnpm` UI build; you must supply `web/dist` yourself |
| **`BOSON_PNPM`** | `build.rs` | Override `pnpm` binary path |
| **`BOSON_API_URL`** | `web` dev | Vite proxy target for `/api` (default `http://127.0.0.1:8787`) |
| **`VITE_DEV_PORT`** | `web` dev | Vite listen port (default `5173`) |
| **`BOSON_UPDATE_REPO`**, **`BOSON_UPDATE_ASSET`** | `boson update` | Self-update source (defaults to `yogthesharma/boson-dev` and `boson-<target>.tar.gz`/`.zip`) |
| **`BOSON_VERSION`**, **`BOSON_INSTALL_DIR`**, **`BOSON_INSTALL_REPO`** | `install.sh` | Pin version, install destination, or source repo for the curl-pipe installer |

---

## Example workspace

The [`example/`](example/) directory is a full **playground**: a tiny **Fastify** server plus a ready-made Boson project (folders, env, **`{{secret:...}}`** demo). Follow **[`example/README.md`](example/README.md)** for the end-to-end walkthrough.

Typical two-terminal flow:

```bash
# terminal 1 — demo API
cd example/server && pnpm install && pnpm dev

# terminal 2 — Boson against ./example
cargo run --no-default-features -- dev --project-dir example
```

---

## License

MIT — see [`Cargo.toml`](Cargo.toml) `license` field.

---

**Summary:** Boson is a **local, code-first REST client** inspired by **Postman/Bruno**, built around **YAML collections**, a **Rust + SQLite** core, and a **modern React UI**—with **no cloud dependency** for day-to-day use.
