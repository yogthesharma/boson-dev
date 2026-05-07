# Sync, Drafts & Overrides — Plan

> Working document. Tick boxes as we land slices; update sections as decisions
> firm up.

## 1. Goal

YAML in the repo is the **authoring source of truth** for API requests.
Boson's web app needs to support three behaviors without breaking that:

1. **Code-first publish** — a dev edits YAML, runs `boson push`, the team sees it.
2. **Per-user iteration** — a dev wants to test their unpublished spec without
   forcing teammates to see half-baked work (`boson dev`).
3. **Per-user UI tweaks** — a dev tweaks a request in the UI (URL, headers,
   body, …) without changing what teammates see; can reset to canonical at any
   time. Plus user-only requests (Postman-style personal items).

## 2. Three-layer model

All three layers live **server-side** and are merged on read.

| Layer | Owner | Source | Visible to | Created via |
|---|---|---|---|---|
| **Canonical** | Workspace | YAML | Everyone in workspace | `boson push` |
| **User Draft** | User | YAML (live-watched) | Only that user | `boson dev` |
| **User Override** | User | UI edits on top of canonical/draft | Only that user | Web UI |
| **User Request** | User | UI-created; no canonical link | Only that user (v1) | Web UI |

UI render precedence: **override > draft > canonical**.

Render payload from `GET /v1/workspace` per request looks like:

```jsonc
{
  "id": "...",
  "method": "POST",
  "url": "...",            // post-merge
  "headers": [ ... ],
  "body": { ... },
  "source": "canonical" | "draft" | "user",
  "overridden_fields": ["url", "headers.0.value"],
  "draft_fields": ["headers"]   // present when draft active
}
```

## 3. Decisions to lock (gating)

Tick when an answer is committed. Recommendation in **bold**.

- [x] **D1.** `boson push` reads YAML on disk → posts to server. **(recommended)**
      Alternative: promotes the user's draft slot to canonical.
- [x] **D2.** UI shows a small `DRAFT` badge on draft-sourced requests + a
      "compare with canonical" toggle. **(recommended yes)** — badge shipped;
      compare toggle deferred (optional follow-up).
- [x] **D3.** Draft lifetime: **persists until next push or `boson dev --reset`**.
      Alternative: dies on `boson dev` Ctrl-C. _(needed in Slice E)_
- [x] **D4.** Override vs draft conflict: **override wins, UI shows
      "draft updated this field" hint**. Alternative: silent override-wins.
      _(Merge order implemented; per-field hint deferred.)_
- [x] **D5.** Multi-machine: **last-writer-wins per (user, workspace)**.
      Alternative: per-machine slots keyed by `machine_id`. _(needed in
      Slice E)_
- [x] **D6.** Wire format: **whole parsed YAML payload**. Content-hash
      short-circuit deferred to Slice E (drafts) where it actually matters.
- [x] **D7.** Auth: pick one for v1 — GitHub OAuth, email magic-link, or
      simple API token. **Shipped:** email + password `POST /v1/auth/register`
      / `POST /v1/auth/login`, HS256 JWT in `Authorization: Bearer`, optional
      `BOSON_AUTH_DISABLED=1` for local dev (acts as bootstrap user id `1`).
- [x] **D8.** Minimal YAML schema locked (see §5).
- [x] **D9.** Stable canonical request identity: **explicit `id:` field
      required in YAML**. Renames keep overrides attached.
- [x] **D10.** Override granularity: **per-field patch** (per-field reverts
      possible). Alternative: whole-request snapshot. _(needed in Slice C)_
- [x] **D11.** "Promote override to YAML" flow (e.g. `boson pull`):
      **out of scope for v1.**

## 4. Slices (build order)

Each slice is independently shippable and testable end-to-end.

### Slice A — Code-first MVP (no auth, no drafts, no overrides) ✅

Smallest possible end-to-end loop: edit YAML → push → see it in the UI.
Unblocks every other slice.

- [x] Lock minimal YAML schema (D8).
- [x] Postgres schema (`apps/server/migrations/001_canonical.sql`):
  - [x] `workspace`
  - [x] `request_canonical` (workspace_id, request_id, method, url, headers, body, ...)
  - [x] `environment` (workspace_id, name, base_url, vars)
- [x] Server:
  - [x] `POST /v1/canonical` — replace canonical for a workspace
        (transactional: clear & insert all rows).
  - [x] `GET /v1/workspace` — merged per-user view after Slice B–E (override \>
        draft \> canonical + `userRequests`; see `buildMergedWorkspaceView`).
  - [x] Boot-time migrations runner (`apps/server/src/db/migrate.ts`).
- [x] CLI:
  - [x] `boson push` parses local YAML against the schema and POSTs.
  - [x] `boson init` scaffolds a starter `boson.yml`.
  - [x] Friendly error output on validation failure (with JSON-path).
- [x] Web:
  - [x] Replace hardcoded request state with `GET /v1/workspace`.
  - [x] Sidebar: list canonical requests; click → load into request bar.
  - [x] Read-only behavior on canonical (overrides come in Slice C).

### Slice B — Auth ✅

- [x] Implement D7.
- [x] DB: `app_user` (JWT auth; no separate session table — stateless HS256).
- [x] `/v1/*` routes require `Authorization: Bearer` except `POST /v1/auth/login`
      and `POST /v1/auth/register`. Health + proxy stay public. Optional
      `BOSON_AUTH_DISABLED=1` uses bootstrap user id `1`.
- [x] CLI: `boson login` / `boson register` write `~/.config/boson/auth.json`;
      `boson push` sends `Authorization: Bearer …` when a token is stored.
- [x] Web: sidebar sign-in + bearer on `GET /v1/workspace` and mutations.

### Slice C — Overrides ✅

- [x] DB: `request_override` (user_id, workspace_id, request_id, patch JSONB).
- [x] Server:
  - [x] `PATCH /v1/requests/:id/override`
  - [x] `DELETE /v1/requests/:id/override` (full reset)
  - [x] `DELETE /v1/requests/:id/override/:field` (per-field reset; fields:
        `method`, `name`, `url`, `headers`, `body`)
- [x] `GET /v1/workspace` returns merged result + `overridden_fields[]` (top-level keys).
- [x] Web:
  - [x] Per-field revert: "Revert URL" when URL is overridden (more fields can follow the same pattern).
  - [x] Global "Reset overrides" for the selected canonical/draft-backed request.
  - [x] Amber dot in sidebar when a request has overrides.

### Slice D — User-only requests ✅

- [x] DB: `request_user` (text id, user_id, workspace_id, name, method, url, headers, body, sort_index).
- [x] Server: `POST/PATCH/DELETE /v1/user-requests`.
- [x] Web:
  - [x] "+ New Request" CTA in sidebar (next to Requests heading).
  - [x] "Personal" section + `You` badge for user-only rows.
  - [x] Delete via "Delete request" in the request toolbar.

### Slice E — Drafts (`boson dev`) ✅

- [x] DB: `request_draft` (user_id, workspace_id, payload, content_hash, updated_at).
- [x] Server:
  - [x] `POST /v1/drafts` — accepts whole YAML payload + hash; short-circuit
        on unchanged hash.
  - [x] `DELETE /v1/drafts` — `boson dev --reset` / Ctrl-C handler.
- [x] CLI: `boson dev`
  - [x] `notify`-based watcher on the YAML file (parent directory watched).
  - [x] On change: parse → validate → POST.
  - [x] On Ctrl-C / `--reset` → DELETE.
- [x] `GET /v1/workspace` precedence: override > draft > canonical.
- [x] Web:
  - [x] `Draft` badge on draft-sourced requests (D2).
  - [ ] Optional "compare with canonical" toggle (deferred).

### Slice F — Polish

- [ ] Per-env health probe ("ghost endpoint" mitigation).
  - [ ] Server periodic / on-demand `OPTIONS|HEAD` per request × env.
  - [ ] Sidebar dot: green/grey/red.
- [ ] Drift indicator: "canonical updated since you overrode" badge.
- [ ] `boson status` — list local-vs-server diffs, draft state, override count.
- [ ] `boson push --dry-run` — schema validate + diff vs canonical.

## 5. YAML schema (D8 — locked for v1)

Single file `boson.yml` at the repo root.

```yaml
workspace: my-team           # slug; required

environments:                # required, at least one
  - name: local
    baseUrl: http://localhost:8080
    vars:                    # optional; merged into {{var}} interpolation
      apiKey: dev-key

requests:                    # required (may be empty)
  - id: users.get-by-id      # required, stable across renames
    name: Get User           # required, display name
    method: GET              # required, one of GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS
    url: "{{baseUrl}}/users/1"
    headers:                 # optional, map of name -> value
      Accept: application/json
    body:                    # optional; defaults to { type: none }
      type: none

  - id: users.create
    name: Create User
    method: POST
    url: "{{baseUrl}}/users"
    headers:
      Content-Type: application/json
    body:
      type: json
      content: |
        { "name": "Boson" }
```

Body shape:

| `type` | `content` | Notes |
|---|---|---|
| `none` | — | No body sent. |
| `json` / `xml` / `text` / `sparql` | string | Sent verbatim; Content-Type defaulted from type. |
| `form-urlencoded` | `{ key: value }` map | Server URL-encodes. |
| `multipart` / `file` | — | **Deferred**, not part of v1 schema. |

Still-open schema questions (non-blocking, deferred):

- [ ] Folder layout: single file vs `requests/*.yml` merged.
- [ ] Secrets / env interpolation rules beyond plain `{{var}}`.
- [ ] Auth definitions (Bearer / Basic / API key) baked into YAML or per-user.
- [ ] Request grouping / folders.

## 6. Out of scope (v1)

- Promote-overrides-back-to-YAML (`boson pull`).
- Branch / channel separation per workspace.
- CI gating of `boson push`.
- Multi-workspace per user (assume one workspace for now; can extend).
- Multipart / file uploads through the proxy (still on the wider TODO).

## 7. Open questions (parking lot)

- [ ] How do we handle YAML deletes? (Push wipes-and-replaces; what about
      orphaned overrides on deleted requests? Soft-delete + UI flag?)
- [ ] Audit log / who-pushed-when?
- [ ] Snapshots / rollback?
- [ ] Rate limit / quota on the proxy?
- [ ] Sharing user-only requests within the workspace (currently private).

## 8. Status log

- 2026-05-07 — initial plan committed (this doc).
- 2026-05-07 — Slice A locked: D1, D6 (whole-YAML, hash deferred), D8, D9, D11
  decided. Implementation started.
- 2026-05-07 — Slice A landed end-to-end. CLI `boson push` + `boson init`,
  server `POST /v1/canonical` / `GET /v1/workspace`, web sidebar driven by
  the canonical workspace. Sample `boson.yml` at repo root.
- 2026-05-07 — Slices **B–E** landed: JWT auth (`app_user`, `/v1/auth/*`),
  protected `/v1/*`, merged `GET /v1/workspace` (override \> draft \> canonical),
  `request_override` + `request_user` + `request_draft`, CLI `boson login` /
  `boson register` / `boson dev`, web sign-in + override toolbar + personal
  requests + draft badge. Slice **F** (polish) still open.
