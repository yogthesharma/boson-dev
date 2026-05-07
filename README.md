# Boson

**Docker-first** local stack: Postgres, Redis, API (Node), static UI (nginx).

| Path | Role |
|------|------|
| `apps/server` | HTTP API (Hono) — talks to Postgres + Redis |
| `apps/web` | Vite + React + Tailwind — built to static files behind nginx |
| `cli/` | Rust `boson` CLI (separate crate; not part of pnpm) |

## Quick start (Docker)

```bash
cp .env.example .env   # optional; compose has defaults
docker compose up --build
```

Then open **http://localhost:8080** — the UI is served on port **8080** by default. Nginx proxies **`/api/*`** to the server (so the browser does not need CORS to `localhost:3001`).

- API (direct): http://localhost:3001/health
- `POST http://localhost:3001/v1/canonical` — replace canonical workspace from a YAML payload (used by `boson push`).
- `GET http://localhost:3001/v1/workspace` — current canonical workspace (used by the web app to populate the sidebar).
- `POST http://localhost:3001/proxy` — server-side HTTP proxy for the web client (avoids browser CORS). The UI calls it via `/api/proxy` in dev. The browser never talks to your API host directly, so **local endpoints work**: use `http://127.0.0.1:PORT` or `http://localhost:PORT` when the Boson API runs on your machine (`pnpm dev`). Optional JSON fields: `timeoutMs` (1000–120000), `redirect` (`"follow"` \| `"manual"`).
- **Docker note:** Inside a container, `localhost` is the container itself. To hit a service on your Mac/Windows host, use `http://host.docker.internal:PORT` as the request URL.
- Postgres: `localhost:5433` (user/pass/db: `boson`) — host port is **5433** by default so it doesn't fight a local install. Override via `POSTGRES_PORT` in `.env`.  
- Redis: `localhost:6379`

Stop:

```bash
docker compose down
```

## Day-to-day dev (`pnpm dev`)

One command — DBs in Docker, apps in watch mode on your terminal.

```bash
pnpm install
pnpm dev          # docker up -d postgres+redis (waits healthy), then runs server + web in parallel
```

- API: http://localhost:3001 (tsx watch mode, restarts on save)
- Web: http://localhost:5173 (Vite HMR; `/api` proxied to the API)
- Postgres: `localhost:5433` (override via `POSTGRES_PORT` in `.env`)
- Redis: `localhost:6379`

Ctrl+C stops the apps; the Docker DBs keep running for fast restart. Tear them down explicitly:

```bash
pnpm dev:db:down       # stop containers, keep volumes
pnpm docker:reset      # nuke containers + volumes (wipes DB data)
```

Other handy scripts:

| Script | What it does |
|--------|--------------|
| `pnpm dev:db` | Just bring up Postgres + Redis (no apps) |
| `pnpm dev:db:logs` | Tail DB logs |
| `pnpm dev:apps` | Just run server + web (assume DBs already up) |
| `pnpm docker:up` | Full stack in containers (server + web included) |
| `pnpm docker:down` | Stop everything |
| `pnpm docker:logs` | Tail logs from all four containers |

## Rust CLI

```bash
cd cli && cargo build && cargo run -- --help
```

The CLI is intentionally **outside** the pnpm workspace.

### Commands

```bash
# Scaffold a starter spec.
cargo run --manifest-path cli/Cargo.toml -- init

# Push the local boson.yml to the server (default: http://localhost:3001).
cargo run --manifest-path cli/Cargo.toml -- push --file boson.yml

# Validate without sending.
cargo run --manifest-path cli/Cargo.toml -- push --file boson.yml --dry-run
```

Override the server with `--server` or the `BOSON_SERVER_URL` env var.

### `boson.yml` schema

See [`docs/sync-and-overrides.md`](docs/sync-and-overrides.md) §5 for the full
shape. A working sample lives at the repo root (`boson.yml`).
