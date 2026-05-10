//! Serializable types returned from the SQLite store. These cross the API
//! boundary, so they live in their own module to keep the schema-of-record
//! easy to spot.

use serde::{Deserialize, Serialize};

use crate::config::{ApiRequest, Environment};

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
    pub(super) fn as_str(&self) -> &'static str {
        match self {
            RunStatus::Pending => "pending",
            RunStatus::Running => "running",
            RunStatus::Completed => "completed",
            RunStatus::Failed => "failed",
            RunStatus::Canceled => "canceled",
        }
    }

    pub(super) fn parse(s: &str) -> Self {
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
