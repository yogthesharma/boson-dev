//! SQLite DDL. Idempotent — `Store::open` runs `migrate` every time.

use rusqlite::Connection;

pub(super) fn migrate(conn: &mut Connection) -> anyhow::Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );

        CREATE TABLE IF NOT EXISTS project_snapshot (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            name TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            raw_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS environments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            variables_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS requests (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            raw_json TEXT NOT NULL,
            source_hash TEXT NOT NULL,
            source_path TEXT
        );

        CREATE TABLE IF NOT EXISTS drafts (
            request_id TEXT PRIMARY KEY,
            draft_json TEXT NOT NULL,
            base_hash TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL,
            environment_id TEXT,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            history_id INTEGER,
            error TEXT
        );

        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            request_id TEXT NOT NULL,
            environment_id TEXT,
            method TEXT NOT NULL,
            url TEXT NOT NULL,
            status INTEGER,
            duration_ms INTEGER NOT NULL,
            response_headers_json TEXT NOT NULL,
            response_body TEXT NOT NULL,
            response_truncated INTEGER NOT NULL DEFAULT 0,
            error TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS secrets (
            name TEXT PRIMARY KEY,
            ciphertext BLOB NOT NULL,
            updated_at TEXT NOT NULL
        );

        INSERT OR IGNORE INTO schema_version(version) VALUES (1);
        "#,
    )?;
    Ok(())
}
