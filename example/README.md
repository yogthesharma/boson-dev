# Boson example workspace

A self-contained playground for exercising the Boson UI and runner end-to-end.
It pairs a tiny Fastify HTTP server with a Boson project that targets it.

```
example/
├── boson.yml                # Boson manifest
├── boson/
│   ├── environments.yml     # `local` env pointing at http://127.0.0.1:4321
│   └── requests.yml         # Health / Todos / Diagnostics / Auth folders
├── .boson/                  # local-only state (state.db, key.bin)
└── server/                  # Fastify server backing the requests
    ├── package.json
    └── src/server.js
```

## 1. Start the example API

Quick start (repo root, one command):

```bash
just dev-example
```

This starts the Fastify example API and then runs **`cargo run --no-default-features -- dev --project-dir example`** (Vite + HMR — contributor workflow from this repo).

If you prefer Cargo aliases for the Rust/web side:

```bash
cargo dev-example
```

**Installed release binary:** start the API (see Manual mode below), then from repo root run `BOSON_PROJECT_DIR="$(pwd)/example" boson serve`, or `cd example && boson serve`.

Manual mode:

```bash
cd example/server
pnpm install            # only needed the first time
pnpm dev                # starts Fastify on http://127.0.0.1:4321 with --watch
```

Quick sanity check:

```bash
curl http://127.0.0.1:4321/health
curl http://127.0.0.1:4321/todos
```

## 2. Run Boson against the example project

From the repo root, in another terminal (API from step 1 must be running).

**Release-style binary** (`boson` from GitHub releases):

```bash
cd example && boson serve
```

**From this repo with embedded UI** (default `cargo build --release`):

```bash
cargo run --release -- serve --project-dir example
```

**Contributor stack** (Vite + HMR, same as `just dev-example`):

```bash
cargo run --no-default-features -- dev --project-dir example --no-open
```

That serves the embedded UI at <http://127.0.0.1:8787> (unless you pass `--port`) and watches `example/`
for YAML changes. The sidebar should list `Health check`, `List todos`,
`Create todo`, `Echo (json)`, `Secure (bearer)`, etc.

## 3. Try the Secure (bearer) request

The `secure` request uses `{{secret:DEMO_TOKEN}}`. Seed it once before running:

```bash
cargo run -- run secure --project-dir example   # without secret -> 401
curl -X POST http://127.0.0.1:8787/api/secrets/DEMO_TOKEN \
  -H 'content-type: application/json' \
  -d '{"value":"boson-demo-token"}'
cargo run -- run secure --project-dir example   # now -> 200
```

The Fastify server expects `Bearer boson-demo-token` (override with the
`DEMO_TOKEN` env var when starting the server). Secrets are persisted
encrypted in `example/.boson/state.db` using the per-project key in
`example/.boson/key.bin`.

## What the API exposes

| Method | Path             | Purpose                                       |
| ------ | ---------------- | --------------------------------------------- |
| GET    | `/health`        | service metadata                              |
| GET    | `/todos`         | list todos (filter via `?done=true|false`)    |
| GET    | `/todos/:id`     | fetch one todo                                |
| POST   | `/todos`         | create a todo (`{ title, done? }`)            |
| PATCH  | `/todos/:id`     | update a todo (any subset of fields)          |
| DELETE | `/todos/:id`     | delete a todo (returns 204)                   |
| POST   | `/echo`          | echoes method, headers, query, and body       |
| GET    | `/secure`        | requires `Bearer boson-demo-token`            |

The store resets on every restart, which keeps the demo deterministic.
