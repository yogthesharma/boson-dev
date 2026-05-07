-- Slice A: workspace + canonical requests + environments.
-- Idempotent: uses CREATE TABLE IF NOT EXISTS so it can run on every boot
-- until we add a real migrations tracker.

CREATE TABLE IF NOT EXISTS workspace (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS environment (
  id            SERIAL PRIMARY KEY,
  workspace_id  INTEGER NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  base_url      TEXT NOT NULL,
  vars          JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_index    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS request_canonical (
  id            SERIAL PRIMARY KEY,
  workspace_id  INTEGER NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  request_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  method        TEXT NOT NULL,
  url           TEXT NOT NULL,
  headers       JSONB NOT NULL DEFAULT '{}'::jsonb,
  body          JSONB NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  sort_index    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, request_id)
);

CREATE INDEX IF NOT EXISTS request_canonical_workspace_idx
  ON request_canonical (workspace_id, sort_index);
