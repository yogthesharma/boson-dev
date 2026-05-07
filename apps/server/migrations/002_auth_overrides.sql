-- Slice B–E: users, per-user overrides, personal requests, YAML drafts.

CREATE TABLE IF NOT EXISTS app_user (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fixed id=1 for BOSON_AUTH_DISABLED=1 middleware (never used for password check).
INSERT INTO app_user (id, email, password_hash)
SELECT
  1,
  '__boson_bootstrap__@system',
  '$2b$10$rxeTn3bsz5Le5RabxQM5ge1D0oOiNGM5XgYHH0/BkxshUxYGRzzPW'
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE id = 1);

SELECT setval(
  pg_get_serial_sequence('app_user', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM app_user), 1)
);

CREATE TABLE IF NOT EXISTS request_override (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  workspace_id   INTEGER NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
  request_id     TEXT NOT NULL,
  patch          JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, workspace_id, request_id)
);

CREATE INDEX IF NOT EXISTS request_override_user_workspace_idx
  ON request_override (user_id, workspace_id);

CREATE TABLE IF NOT EXISTS request_user (
  id             TEXT PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  workspace_id   INTEGER NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  method         TEXT NOT NULL,
  url            TEXT NOT NULL,
  headers        JSONB NOT NULL DEFAULT '{}'::jsonb,
  body           JSONB NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  sort_index     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS request_user_user_workspace_idx
  ON request_user (user_id, workspace_id, sort_index);

CREATE TABLE IF NOT EXISTS request_draft (
  user_id        INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  workspace_id   INTEGER NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
  payload        JSONB NOT NULL,
  content_hash   TEXT NOT NULL DEFAULT '',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_id)
);
