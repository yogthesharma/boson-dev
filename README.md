# boson

A Rust CLI with an embedded Vite + React + TypeScript UI. The same binary can:

- **Serve the production UI** from assets compiled into the executable
  (`boson serve`).
- **Run a dev loop** that spawns the Vite dev server and reverse-proxies it,
  including HMR websockets, so the Rust process is always the single
  entrypoint (`boson dev`).

## Layout

```
boson/
├── Cargo.toml
├── build.rs              # runs `pnpm build` in web/ when embedding the UI
├── src/
│   ├── main.rs           # tracing + clap entrypoint
│   ├── cli.rs            # `boson serve` and `boson dev` commands
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

### Development (HMR)

```bash
cargo run --no-default-features -- dev
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
boson dev --port 9000 --vite-port 5174    # custom ports
boson dev --no-spawn-vite                 # bring your own `pnpm dev`
boson dev --no-open                       # don't auto-open the browser
```

### Production (single binary)

```bash
cargo build --release
./target/release/boson serve
```

The `embed-ui` feature (default-on) causes `build.rs` to run `pnpm install` /
`pnpm build` in `web/` and `rust-embed` bakes `web/dist/` into the binary.
The resulting executable has no Node runtime requirement.

## API

The Rust server owns `/api/*`. Two example endpoints are wired up:

- `GET /api/health` → `{ "status": "ok", "version": "0.1.0" }`
- `GET /api/version` → `{ "name": "boson", "version": "0.1.0" }`

Add new routes in `src/server.rs`. Anything outside `/api/*` falls through to
the UI (embedded assets in release, Vite proxy in dev).

## Environment variables

- `RUST_LOG` — standard tracing filter, e.g. `RUST_LOG=boson=debug,tower_http=info`.
- `BOSON_SKIP_WEB_BUILD` — set during `cargo build` to skip the UI build (you
  must have already populated `web/dist`).
- `BOSON_PNPM` — override the `pnpm` binary used by `build.rs`.
