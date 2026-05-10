//! Row-mapping helpers and small utilities used across store ops.

use rusqlite::MappedRows;

use crate::config::Environment;

use super::types::{Draft, ResponseHistory, Run, RunStatus};

pub(super) fn row_to_environment(row: &rusqlite::Row<'_>) -> rusqlite::Result<Environment> {
    let variables_json: String = row.get(2)?;
    Ok(Environment {
        id: row.get(0)?,
        name: row.get(1)?,
        variables: serde_json::from_str(&variables_json).unwrap_or_default(),
    })
}

pub(super) fn row_to_draft(row: &rusqlite::Row<'_>) -> rusqlite::Result<Draft> {
    let draft_json: String = row.get(1)?;
    Ok(Draft {
        request_id: row.get(0)?,
        request: serde_json::from_str(&draft_json).map_err(json_err_to_sql)?,
        base_hash: row.get(2)?,
        updated_at: row.get(3)?,
    })
}

pub(super) fn row_to_history(row: &rusqlite::Row<'_>) -> rusqlite::Result<ResponseHistory> {
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

pub(super) fn row_to_run(row: &rusqlite::Row<'_>) -> rusqlite::Result<Run> {
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

pub(super) fn collect_rows<T>(
    rows: MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>,
) -> anyhow::Result<Vec<T>> {
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub(super) fn json_err_to_sql(err: serde_json::Error) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(err))
}

/// FNV-1a 64-bit hex used for cheap drift detection between the canonical
/// request (from YAML) and the draft's view of it. We don't need cryptographic
/// strength here, just stable change detection.
pub(super) fn source_hash(input: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;
    for byte in input.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(PRIME);
    }
    format!("{hash:016x}")
}
