# Boson — current status

> Snapshot of where the product is. Plan/spec lives in
> [`docs/sync-and-overrides.md`](docs/sync-and-overrides.md); this file is the
> _what works today_ view.

_Last updated: 2026-05-08_

## TL;DR

A code-first API client. `boson.yml` in the repo is the canonical source of
truth; each user can layer **drafts** (live-watched local YAML), **per-field
overrides** in the UI, and **personal requests** on top. The merged view is
served by the API and rendered by the web app. CLI is a separate Rust crate.

Slices A–E are shipped end-to-end. Slice F (polish) is the remaining bucket.

## Architecture

| Path | Role | Stack |
|---|---|---|
| `apps/server` | HTTP API: auth, canonical/draft/override storage, server-side proxy | Hono on Node, Postgres, Redis, jose JWT, bcryptjs |
| `apps/web` | SPA: sidebar, request/response panes, login page, override toolbar | Vite + React 19 + Tailwind 4 + tiny custom router |
| `cli/` | `boson` CLI (separate Cargo crate, not in pnpm) | Rust + clap + reqwest + notify + sha2 |
| `docker-compose.yml` | Postgres + Redis + server + nginx-fronted web | Docker |

Browser → server is same-origin via `/api` (Vite proxy in dev, nginx in prod),
so the web app never deals with CORS to its own backend.

## Feature matrix (end-to-end status)

Legend — DB: migration/table, API: server route, CLI: Rust subcommand,
Web: React UI. **E2E** = working through CLI **and** web after auth.

| # | Feature | DB | API | CLI | Web | E2E? |
|---|---|---|---|---|---|---|
| 1 | YAML schema (workspace + envs + requests, body kinds) | — | validates on push | `boson init`, parses on `push` / `dev` | typed in `lib/workspace.ts` | ✅ |
| 2 | Push canonical workspace | `workspace`, `environment`, `request_canonical` | `POST /v1/canonical` (transactional replace) | `boson push [--dry-run] [--server …]` | sidebar shows result | ✅ |
| 3 | Read merged workspace | reads all 4 layer tables | `GET /v1/workspace` (`buildMergedWorkspaceView`) | n/a | sidebar + request pane consume `MergedRequest` | ✅ |
| 4 | Auth — register / login / JWT | `app_user` (bootstrap id 1) | `POST /v1/auth/register`, `POST /v1/auth/login`, `requireAuth` middleware | `boson register`, `boson login` → `~/.config/boson/auth.json` | dedicated `/login` page; bearer on every protected fetch; **Sign in / Sign out** in top bar | ✅ |
| 5 | Per-user overrides (per-field patch) | `request_override` (JSONB patch) | `PATCH /v1/requests/:id/override`, `DELETE …`, `DELETE …/:field` | n/a | toolbar **Save to server**, **Reset overrides**, **Revert URL**; amber dot in sidebar | ✅ (UI per-field surface = URL only) |
| 6 | Personal (user-only) requests | `request_user` | `POST/PATCH/DELETE /v1/user-requests` | n/a | sidebar **+** new request, **Personal** section, `You` badge, **Delete request** | ✅ |
| 7 | Live YAML drafts (`boson dev`) | `request_draft` (payload + `content_hash`) | `POST /v1/drafts` (hash short-circuit), `DELETE /v1/drafts` | `boson dev`, `boson dev --reset`, Ctrl-C cleanup | `Draft` badge in sidebar; merged view ships `draft_fields[]` | ✅ |
| 8 | Server-side proxy (CORS-free outbound) | — | `POST /proxy` (timeout, redirect mode) | n/a | `RequestPane` Send → `ResponsePane` | ✅ |
| 9 | Health probe | — | `GET /health` (Postgres + Redis ping) | n/a | green/red dot in top bar | ✅ |
| 10 | Environments + `{{var}}` interpolation | `environment` | shipped via `GET /v1/workspace` | parsed from YAML | env switcher in top bar; persisted in `localStorage` | ✅ |
| 11 | Request history (per browser) | — | — | n/a | `useRequestHistory`, replay click | ✅ |
| 12 | Boot-time migrations | `migrations/001_*.sql`, `migrations/002_*.sql` | `db/migrate.ts` runs on boot | n/a | n/a | ✅ |
| 13 | Docker compose stack | volumes | server image + nginx-served web | n/a | served at `:8080`, `/api` proxied to server | ✅ |

## Slice status vs the plan

| Slice | Scope | Status |
|---|---|---|
| **A** Code-first MVP | YAML → push → web list | ✅ Shipped |
| **B** Auth | JWT, register/login, protected `/v1/*`, dedicated `/login` page | ✅ Shipped |
| **C** Overrides | Per-user patch w/ reverts | ✅ Shipped (UI per-field surface = URL only; server supports all) |
| **D** User-only requests | Personal CRUD + sidebar | ✅ Shipped |
| **E** Drafts (`boson dev`) | Watcher + hash + merge precedence | ✅ Shipped (compare-with-canonical toggle deferred) |
| **F** Polish | Health probes per env, drift indicator, `boson status`, dry-run diff | ⏳ Open |

## What's still open

| Area | Item |
|---|---|
| Slice F | Per-env health probe per request × env (sidebar dot green/grey/red). |
| Slice F | "Drift" badge — canonical changed since you overrode. |
| Slice F | `boson status` — local-vs-server diff + draft state + override count. |
| Slice F | `boson push --dry-run` shows diff vs server canonical (today only validates locally). |
| Drafts UX | "Compare with canonical" toggle on draft-sourced requests (D2 second half). |
| Overrides UX | Per-field revert buttons for `method`, `headers`, `body`, `name` (server already supports them). |
| Overrides UX | "Draft updated this field" hint when override masks a draft change (D4 second half). |
| YAML schema | Folder layout `requests/*.yml`; richer interpolation/secrets; YAML auth blocks; folders/groups. |
| YAML schema | `multipart` / `file` bodies through the proxy. |
| Lifecycle | `boson pull` (promote override → YAML) — explicitly out of scope for v1. |
| Multi-tenancy | Multiple workspaces per user, branches/channels, CI gating on push. |
| Cleanup | Orphan overrides on canonical-deleted request ids (soft delete + UI flag). |
| Ops | Audit log, snapshots/rollback, proxy rate limit/quota. |
| Sharing | Sharing personal requests within a workspace. |

## Run it

```bash
# DBs only, apps in watch mode
pnpm install
pnpm dev               # spins Postgres + Redis in Docker, server + web in watch

# CLI
cd cli && cargo build
cargo run -- init                    # scaffolds boson.yml
cargo run -- register --email you@x.dev --password ...  # saves token
cargo run -- push                    # POSTs canonical workspace
cargo run -- dev                     # watches boson.yml + posts drafts
```

For local dev without auth, run the server with `BOSON_AUTH_DISABLED=1`
(see `.env.example`); the web app will skip the `/login` step.

Web ports: dev `5173`, prod (compose) `8080`. Server: `3001`.
