//! SQLite-backed local state. Holds a normalized projection of the YAML
//! project plus runtime state: drafts, in-flight runs, request history, and
//! encrypted secrets.
//!
//! YAML files remain the source of truth; this DB is a safety + speed layer
//! that the UI talks to directly. The watcher refreshes the projection on
//! every YAML change.

use std::path::Path;

use anyhow::Context;
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::config::{ApiRequest, Environment, ProjectSnapshot};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectView {
    pub name: String,
    pub schema_version: u16,
    pub environments: Vec<Environment>,
    pub requests: Vec<ApiRequest>,
    pub drafts: Vec<Draft>,
    pub secret_names: Vec<String>,
    /// Drafts whose source request was edited externally since the draft was
    /// created. The UI should warn before saving these.
    pub stale_drafts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Draft {
    pub request_id: String,
    pub request: ApiRequest,
    pub updated_at: String,
    /// Hash of the canonical source request at the time the draft was last
    /// edited. Used to detect drift if YAML changes underneath.
    pub base_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseHistory {
    pub id: i64,
    pub run_id: String,
    pub request_id: String,
    pub environment_id: Option<String>,
    pub method: String,
    pub url: String,
    pub status: Option<u16>,
    pub duration_ms: u128,
    pub response_headers: serde_json::Value,
    pub response_body: String,
    pub response_truncated: bool,
    pub error: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Canceled,
}

impl RunStatus {
    fn as_str(&self) -> &'static str {
        match self {
            RunStatus::Pending => "pending",
            RunStatus::Running => "running",
            RunStatus::Completed => "completed",
            RunStatus::Failed => "failed",
            RunStatus::Canceled => "canceled",
        }
    }
    fn parse(s: &str) -> Self {
        match s {
            "running" => RunStatus::Running,
            "completed" => RunStatus::Completed,
            "failed" => RunStatus::Failed,
            "canceled" => RunStatus::Canceled,
            _ => RunStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Run {
    pub id: String,
    pub request_id: String,
    pub environment_id: Option<String>,
    pub status: RunStatus,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub history_id: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Store {
    path: std::path::PathBuf,
}

impl Store {
    pub fn open(path: impl AsRef<Path>) -> anyhow::Result<Self> {
        let path = path.as_ref().to_path_buf();
        let store = Self { path };
        store.with_conn(migrate)?;
        Ok(store)
    }

    pub fn replace_snapshot(&self, snapshot: &ProjectSnapshot) -> anyhow::Result<()> {
        self.with_conn(|conn| {
            let tx = conn.transaction()?;
            tx.execute("DELETE FROM project_snapshot", [])?;
            tx.execute("DELETE FROM environments", [])?;
            tx.execute("DELETE FROM requests", [])?;

            tx.execute(
                "INSERT INTO project_snapshot (id, name, schema_version, raw_json, updated_at)
                 VALUES (1, ?1, ?2, ?3, ?4)",
                params![
                    snapshot.manifest.name,
                    snapshot.manifest.schema_version,
                    serde_json::to_string(snapshot)?,
                    Utc::now().to_rfc3339(),
                ],
            )?;

            for env in &snapshot.environments {
                tx.execute(
                    "INSERT INTO environments (id, name, variables_json)
                     VALUES (?1, ?2, ?3)",
                    params![env.id, env.name, serde_json::to_string(&env.variables)?],
                )?;
            }

            for request in &snapshot.requests {
                let raw = serde_json::to_string(request)?;
                let hash = source_hash(&raw);
                tx.execute(
                    "INSERT INTO requests (id, name, raw_json, source_hash, source_path)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        request.id,
                        request.name,
                        raw,
                        hash,
                        snapshot.request_sources.get(&request.id).cloned()
                    ],
                )?;
            }

            tx.commit()?;
            Ok(())
        })
    }

    pub fn project_view(&self) -> anyhow::Result<ProjectView> {
        self.with_conn(|conn| {
            let (name, schema_version): (String, u16) = conn.query_row(
                "SELECT name, schema_version FROM project_snapshot WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?;
            let drafts = list_drafts(conn)?;
            let stale_drafts = list_stale_draft_ids(conn)?;
            Ok(ProjectView {
                name,
                schema_version,
                environments: list_environments(conn)?,
                requests: list_requests(conn)?,
                drafts,
                secret_names: list_secret_names(conn)?,
                stale_drafts,
            })
        })
    }

    pub fn environments(&self) -> anyhow::Result<Vec<Environment>> {
        self.with_conn(list_environments)
    }

    pub fn requests(&self) -> anyhow::Result<Vec<ApiRequest>> {
        self.with_conn(list_requests)
    }

    pub fn effective_request(&self, id: &str) -> anyhow::Result<Option<ApiRequest>> {
        self.with_conn(|conn| match get_draft_request(conn, id)? {
            Some(request) => Ok(Some(request)),
            None => get_request(conn, id),
        })
    }

    pub fn environment(&self, id: &str) -> anyhow::Result<Option<Environment>> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT id, name, variables_json FROM environments WHERE id = ?1",
                [id],
                row_to_environment,
            )
            .optional()
            .map_err(Into::into)
        })
    }

    pub fn drafts(&self) -> anyhow::Result<Vec<Draft>> {
        self.with_conn(list_drafts)
    }

    pub fn upsert_draft(&self, request_id: &str, request: &ApiRequest) -> anyhow::Result<Draft> {
        self.with_conn(|conn| {
            let canonical_hash: Option<String> = conn
                .query_row(
                    "SELECT source_hash FROM requests WHERE id = ?1",
                    [request_id],
                    |row| row.get(0),
                )
                .optional()?;
            let base_hash = canonical_hash.unwrap_or_else(|| source_hash(""));
            conn.execute(
                "INSERT INTO drafts (request_id, draft_json, base_hash, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(request_id)
                 DO UPDATE SET draft_json = excluded.draft_json,
                               base_hash = excluded.base_hash,
                               updated_at = excluded.updated_at",
                params![
                    request_id,
                    serde_json::to_string(request)?,
                    base_hash,
                    Utc::now().to_rfc3339(),
                ],
            )?;
            get_draft(conn, request_id)?.context("draft should exist after upsert")
        })
    }

    pub fn delete_draft(&self, request_id: &str) -> anyhow::Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM drafts WHERE request_id = ?1", [request_id])?;
            Ok(())
        })
    }

    pub fn replace_request_from_save(&self, request: &ApiRequest) -> anyhow::Result<()> {
        self.with_conn(|conn| {
            let raw = serde_json::to_string(request)?;
            let hash = source_hash(&raw);
            conn.execute(
                "UPDATE requests SET name = ?2, raw_json = ?3, source_hash = ?4 WHERE id = ?1",
                params![request.id, request.name, raw, hash],
            )?;
            Ok(())
        })
    }

    pub fn create_run(
        &self,
        run_id: &str,
        request_id: &str,
        environment_id: Option<&str>,
    ) -> anyhow::Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO runs (id, request_id, environment_id, status, started_at)
                 VALUES (?1, ?2, ?3, 'pending', ?4)",
                params![run_id, request_id, environment_id, Utc::now().to_rfc3339()],
            )?;
            Ok(())
        })
    }

    pub fn mark_run_status(
        &self,
        run_id: &str,
        status: RunStatus,
        history_id: Option<i64>,
        error: Option<String>,
    ) -> anyhow::Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE runs
                 SET status = ?2, finished_at = ?3, history_id = ?4, error = ?5
                 WHERE id = ?1",
                params![
                    run_id,
                    status.as_str(),
                    Utc::now().to_rfc3339(),
                    history_id,
                    error,
                ],
            )?;
            Ok(())
        })
    }

    pub fn run(&self, id: &str) -> anyhow::Result<Option<Run>> {
        self.with_conn(|conn| get_run(conn, id))
    }

    pub fn list_runs(&self, limit: i64) -> anyhow::Result<Vec<Run>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, request_id, environment_id, status, started_at,
                        finished_at, history_id, error
                 FROM runs ORDER BY started_at DESC LIMIT ?1",
            )?;
            let rows = stmt.query_map([limit], row_to_run)?;
            collect_rows(rows)
        })
    }

    pub fn insert_history(&self, item: NewHistory) -> anyhow::Result<ResponseHistory> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO history (
                    run_id, request_id, environment_id, method, url, status, duration_ms,
                    response_headers_json, response_body, response_truncated, error, created_at
                 )
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    item.run_id,
                    item.request_id,
                    item.environment_id,
                    item.method,
                    item.url,
                    item.status,
                    i64::try_from(item.duration_ms).unwrap_or(i64::MAX),
                    serde_json::to_string(&item.response_headers)?,
                    item.response_body,
                    item.response_truncated as i64,
                    item.error,
                    Utc::now().to_rfc3339(),
                ],
            )?;
            let id = conn.last_insert_rowid();
            get_history(conn, id)?.context("history row should exist after insert")
        })
    }

    pub fn history(&self, limit: i64) -> anyhow::Result<Vec<ResponseHistory>> {
        self.with_conn(|conn| list_history(conn, limit))
    }

    pub fn history_for_request(
        &self,
        request_id: &str,
        limit: i64,
    ) -> anyhow::Result<Vec<ResponseHistory>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, run_id, request_id, environment_id, method, url, status, duration_ms,
                        response_headers_json, response_body, response_truncated, error, created_at
                 FROM history WHERE request_id = ?1 ORDER BY id DESC LIMIT ?2",
            )?;
            let rows = stmt.query_map(params![request_id, limit], row_to_history)?;
            collect_rows(rows)
        })
    }

    pub fn delete_history(&self, id: i64) -> anyhow::Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM history WHERE id = ?1", [id])?;
            Ok(())
        })
    }

    pub fn clear_history(&self) -> anyhow::Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM history", [])?;
            Ok(())
        })
    }

    /// Keep at most `keep` most-recent history rows. Used by the server's
    /// startup hook and any future periodic compaction.
    #[allow(dead_code)]
    pub fn prune_history(&self, keep: i64) -> anyhow::Result<usize> {
        self.with_conn(|conn| {
            let removed = conn.execute(
                "DELETE FROM history WHERE id NOT IN (
                    SELECT id FROM history ORDER BY id DESC LIMIT ?1
                 )",
                [keep],
            )?;
            Ok(removed)
        })
    }

    // --------- secrets (encrypted blobs) ---------

    pub fn upsert_secret(&self, name: &str, ciphertext: &[u8]) -> anyhow::Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO secrets (name, ciphertext, updated_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(name) DO UPDATE SET
                    ciphertext = excluded.ciphertext,
                    updated_at = excluded.updated_at",
                params![name, ciphertext, Utc::now().to_rfc3339()],
            )?;
            Ok(())
        })
    }

    pub fn delete_secret(&self, name: &str) -> anyhow::Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM secrets WHERE name = ?1", [name])?;
            Ok(())
        })
    }

    pub fn secret_ciphertext(&self, name: &str) -> anyhow::Result<Option<Vec<u8>>> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT ciphertext FROM secrets WHERE name = ?1",
                [name],
                |row| row.get::<_, Vec<u8>>(0),
            )
            .optional()
            .map_err(Into::into)
        })
    }

    pub fn secret_names(&self) -> anyhow::Result<Vec<String>> {
        self.with_conn(list_secret_names)
    }

    fn with_conn<T>(
        &self,
        f: impl FnOnce(&mut Connection) -> anyhow::Result<T>,
    ) -> anyhow::Result<T> {
        let mut conn = Connection::open(&self.path)
            .with_context(|| format!("failed to open SQLite DB {}", self.path.display()))?;
        f(&mut conn)
    }
}

#[derive(Debug, Clone)]
pub struct NewHistory {
    pub run_id: String,
    pub request_id: String,
    pub environment_id: Option<String>,
    pub method: String,
    pub url: String,
    pub status: Option<u16>,
    pub duration_ms: u128,
    pub response_headers: serde_json::Value,
    pub response_body: String,
    pub response_truncated: bool,
    pub error: Option<String>,
}

fn migrate(conn: &mut Connection) -> anyhow::Result<()> {
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

fn list_environments(conn: &mut Connection) -> anyhow::Result<Vec<Environment>> {
    let mut stmt =
        conn.prepare("SELECT id, name, variables_json FROM environments ORDER BY name")?;
    let rows = stmt.query_map([], row_to_environment)?;
    collect_rows(rows)
}

fn list_requests(conn: &mut Connection) -> anyhow::Result<Vec<ApiRequest>> {
    let mut stmt = conn.prepare("SELECT raw_json FROM requests ORDER BY name")?;
    let rows = stmt.query_map([], |row| {
        let raw: String = row.get(0)?;
        serde_json::from_str::<ApiRequest>(&raw).map_err(json_err_to_sql)
    })?;
    collect_rows(rows)
}

fn list_drafts(conn: &mut Connection) -> anyhow::Result<Vec<Draft>> {
    let mut stmt = conn.prepare(
        "SELECT request_id, draft_json, base_hash, updated_at FROM drafts ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], row_to_draft)?;
    collect_rows(rows)
}

fn list_stale_draft_ids(conn: &mut Connection) -> anyhow::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT d.request_id FROM drafts d
         INNER JOIN requests r ON r.id = d.request_id
         WHERE r.source_hash <> d.base_hash",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    collect_rows(rows)
}

fn list_history(conn: &mut Connection, limit: i64) -> anyhow::Result<Vec<ResponseHistory>> {
    let mut stmt = conn.prepare(
        "SELECT id, run_id, request_id, environment_id, method, url, status, duration_ms,
                response_headers_json, response_body, response_truncated, error, created_at
         FROM history
         ORDER BY id DESC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map([limit], row_to_history)?;
    collect_rows(rows)
}

fn list_secret_names(conn: &mut Connection) -> anyhow::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT name FROM secrets ORDER BY name")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    collect_rows(rows)
}

fn get_request(conn: &mut Connection, id: &str) -> anyhow::Result<Option<ApiRequest>> {
    conn.query_row("SELECT raw_json FROM requests WHERE id = ?1", [id], |row| {
        let raw: String = row.get(0)?;
        serde_json::from_str::<ApiRequest>(&raw).map_err(json_err_to_sql)
    })
    .optional()
    .map_err(Into::into)
}

fn get_draft(conn: &mut Connection, request_id: &str) -> anyhow::Result<Option<Draft>> {
    conn.query_row(
        "SELECT request_id, draft_json, base_hash, updated_at FROM drafts WHERE request_id = ?1",
        [request_id],
        row_to_draft,
    )
    .optional()
    .map_err(Into::into)
}

fn get_draft_request(
    conn: &mut Connection,
    request_id: &str,
) -> anyhow::Result<Option<ApiRequest>> {
    Ok(get_draft(conn, request_id)?.map(|draft| draft.request))
}

fn get_history(conn: &mut Connection, id: i64) -> anyhow::Result<Option<ResponseHistory>> {
    conn.query_row(
        "SELECT id, run_id, request_id, environment_id, method, url, status, duration_ms,
                response_headers_json, response_body, response_truncated, error, created_at
         FROM history WHERE id = ?1",
        [id],
        row_to_history,
    )
    .optional()
    .map_err(Into::into)
}

fn get_run(conn: &mut Connection, id: &str) -> anyhow::Result<Option<Run>> {
    conn.query_row(
        "SELECT id, request_id, environment_id, status, started_at,
                finished_at, history_id, error
         FROM runs WHERE id = ?1",
        [id],
        row_to_run,
    )
    .optional()
    .map_err(Into::into)
}

fn row_to_environment(row: &rusqlite::Row<'_>) -> rusqlite::Result<Environment> {
    let variables_json: String = row.get(2)?;
    Ok(Environment {
        id: row.get(0)?,
        name: row.get(1)?,
        variables: serde_json::from_str(&variables_json).unwrap_or_default(),
    })
}

fn row_to_draft(row: &rusqlite::Row<'_>) -> rusqlite::Result<Draft> {
    let draft_json: String = row.get(1)?;
    Ok(Draft {
        request_id: row.get(0)?,
        request: serde_json::from_str(&draft_json).map_err(json_err_to_sql)?,
        base_hash: row.get(2)?,
        updated_at: row.get(3)?,
    })
}

fn row_to_history(row: &rusqlite::Row<'_>) -> rusqlite::Result<ResponseHistory> {
    let headers_json: String = row.get(8)?;
    let status: Option<u16> = row.get(6)?;
    let duration_ms: i64 = row.get(7)?;
    let truncated: i64 = row.get(10)?;
    Ok(ResponseHistory {
        id: row.get(0)?,
        run_id: row.get(1)?,
        request_id: row.get(2)?,
        environment_id: row.get(3)?,
        method: row.get(4)?,
        url: row.get(5)?,
        status,
        duration_ms: u128::try_from(duration_ms).unwrap_or_default(),
        response_headers: serde_json::from_str(&headers_json).unwrap_or(serde_json::Value::Null),
        response_body: row.get(9)?,
        response_truncated: truncated != 0,
        error: row.get(11)?,
        created_at: row.get(12)?,
    })
}

fn row_to_run(row: &rusqlite::Row<'_>) -> rusqlite::Result<Run> {
    let status: String = row.get(3)?;
    Ok(Run {
        id: row.get(0)?,
        request_id: row.get(1)?,
        environment_id: row.get(2)?,
        status: RunStatus::parse(&status),
        started_at: row.get(4)?,
        finished_at: row.get(5)?,
        history_id: row.get(6)?,
        error: row.get(7)?,
    })
}

fn collect_rows<T>(
    rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>,
) -> anyhow::Result<Vec<T>> {
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn json_err_to_sql(err: serde_json::Error) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(err))
}

/// FNV-1a 64-bit hex used for cheap drift detection between the canonical
/// request (from YAML) and the draft's view of it. We don't need cryptographic
/// strength here, just stable change detection.
fn source_hash(input: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;
    for byte in input.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(PRIME);
    }
    format!("{hash:016x}")
}
