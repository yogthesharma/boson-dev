# boson

Boson is a local-first REST API client. Users keep API definitions in
source-controlled YAML, while the Rust server projects those files into a local
SQLite database for drafts, request history, and safe UI editing.

The same binary can:

- initialize a project (`boson init`)
- run the local API server and browser UI (`boson dev` / `boson serve`)
- execute requests through Rust and store response history in SQLite
- embed the production Vite + React UI into the executable

## Layout

```
boson/
├── Cargo.toml
├── build.rs              # runs `pnpm build` in web/ when embedding the UI
├── src/
│   ├── main.rs           # tracing + clap entrypoint
│   ├── cli.rs            # init/dev/serve/update commands
│   ├── config.rs         # YAML schema
│   ├── db.rs             # SQLite migrations and repositories
│   ├── project.rs        # project discovery/init/load/save helpers
│   ├── runner.rs         # request execution
│   ├── server.rs         # axum server, /api routes, fallback dispatch
│   ├── proxy.rs          # HTTP + WS reverse proxy to the Vite dev server
│   └── assets.rs         # rust-embed-backed static asset handler
└── web/                  # Vite + React + TS UI
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        └── index.css
```

## Prerequisites

- Rust (the project tracks current stable; nightly works too)
- Node 20+ and `pnpm`

## Quick start

### Initialize a user project

```bash
cargo run --no-default-features -- init ./example-api --name Example
```

This creates:

```text
example-api/
├── boson.yml
├── boson/
│   ├── environments.yml
│   └── requests.yml
└── .boson/
    └── state.db
```

`boson.yml` and `boson/*.yml` are the source of truth and should be committed.
`.boson/state.db` is local runtime state and is added to `.gitignore`.

### Development (HMR)

```bash
cargo run --no-default-features -- dev --project-dir ./example-api
```

This:

1. Starts the axum server on `http://127.0.0.1:8787`.
2. Spawns `pnpm dev` in `web/` (running Vite on `127.0.0.1:5173`).
3. Reverse-proxies any non-`/api/*` request to Vite, including the HMR
   WebSocket. Edits in `web/src/**` hot-reload in the browser.

`--no-default-features` skips the heavy `pnpm build` step in `build.rs` for
faster Rust iteration; you can also use the default features if you don't mind
the upfront UI build.

Useful flags:

```bash
boson dev --project-dir ./example-api --port 9000 --vite-port 5174
boson dev --project-dir ./example-api --no-spawn-vite
boson dev --project-dir ./example-api --no-open
```

### Production (single binary)

```bash
cargo build --release
./target/release/boson serve --project-dir ./example-api
```

The `embed-ui` feature (default-on) causes `build.rs` to run `pnpm install` /
`pnpm build` in `web/` and `rust-embed` bakes `web/dist/` into the binary.
The resulting executable has no Node runtime requirement.

## API

The Rust server owns `/api/*`. Initial endpoints:

- `GET /api/health`
- `GET /api/version`
- `GET /api/project`
- `GET /api/environments`
- `GET /api/requests`
- `GET /api/drafts`
- `POST /api/drafts/{request_id}`
- `DELETE /api/drafts/{request_id}`
- `POST /api/drafts/{request_id}/save`
- `GET /api/history`
- `POST /api/requests/{request_id}/run`

Anything outside `/api/*` falls through to the UI (embedded assets in release,
Vite proxy in dev).

## Environment variables

- `RUST_LOG` — standard tracing filter, e.g. `RUST_LOG=boson=debug,tower_http=info`.
- `BOSON_SKIP_WEB_BUILD` — set during `cargo build` to skip the UI build (you
  must have already populated `web/dist`).
- `BOSON_PNPM` — override the `pnpm` binary used by `build.rs`.
