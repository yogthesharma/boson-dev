//! Schema and YAML serialization for Boson projects.
//!
//! Source-of-truth files live in the user's repo:
//!
//! - `boson.yml` — manifest with schema version, project name, and includes
//! - any number of YAML files matched by `includes` glob patterns; each may
//!   contain `environments:` and/or `requests:` top-level lists
//!
//! We bumped to schema_version 2 to add structured query/auth/body/options
//! and multi-file glob includes. Older v1 files give a friendly error.

mod auth;
mod body;

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

pub use auth::{ApiKeyLocation, Auth};
pub use body::{MultipartField, MultipartSource, RequestBody};

pub const SCHEMA_VERSION: u16 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BosonManifest {
    pub schema_version: u16,
    pub name: String,
    /// Glob patterns (relative to project root) of additional YAML files that
    /// declare environments or requests.
    #[serde(default = "default_includes")]
    pub includes: Vec<String>,
}

fn default_includes() -> Vec<String> {
    vec![
        "boson/environments/**/*.yml".to_string(),
        "boson/environments/**/*.yaml".to_string(),
        "boson/environments.yml".to_string(),
        "boson/requests/**/*.yml".to_string(),
        "boson/requests/**/*.yaml".to_string(),
        "boson/requests.yml".to_string(),
    ]
}

/// One YAML include file. Either section is optional so users can split things
/// however they like.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProjectFile {
    #[serde(default)]
    pub environments: Vec<Environment>,
    #[serde(default)]
    pub requests: Vec<ApiRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Environment {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub variables: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ApiRequest {
    pub id: String,
    pub name: String,
    /// Slash-separated path used purely for grouping in UIs (e.g. `Auth/Login`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,

    #[serde(default = "default_method")]
    pub method: String,
    pub url: String,

    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub headers: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub query: BTreeMap<String, String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth: Option<Auth>,

    /// Accepts either a plain string (legacy) or a tagged object.
    #[serde(default, skip_serializing_if = "RequestBody::is_none")]
    pub body: RequestBody,

    #[serde(default, skip_serializing_if = "RequestOptions::is_default")]
    pub options: RequestOptions,
}

fn default_method() -> String {
    "GET".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RequestOptions {
    #[serde(default = "RequestOptions::default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "RequestOptions::default_follow")]
    pub follow_redirects: bool,
    #[serde(default = "RequestOptions::default_max_redirects")]
    pub max_redirects: usize,
    #[serde(default = "RequestOptions::default_max_response_bytes")]
    pub max_response_bytes: usize,
    #[serde(default)]
    pub cookies: bool,
}

impl RequestOptions {
    fn default_timeout() -> u64 {
        30_000
    }
    fn default_follow() -> bool {
        true
    }
    fn default_max_redirects() -> usize {
        10
    }
    fn default_max_response_bytes() -> usize {
        5 * 1024 * 1024
    }
    pub fn is_default(&self) -> bool {
        self == &RequestOptions::default()
    }
}

impl Default for RequestOptions {
    fn default() -> Self {
        Self {
            timeout_ms: Self::default_timeout(),
            follow_redirects: Self::default_follow(),
            max_redirects: Self::default_max_redirects(),
            max_response_bytes: Self::default_max_response_bytes(),
            cookies: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSnapshot {
    pub manifest: BosonManifest,
    pub environments: Vec<Environment>,
    pub requests: Vec<ApiRequest>,
    /// Mapping of `request_id` -> source YAML file (relative to project root).
    /// Used so saving a draft writes back to the correct file.
    pub request_sources: BTreeMap<String, String>,
}

pub fn sample_manifest(name: impl Into<String>) -> BosonManifest {
    BosonManifest {
        schema_version: SCHEMA_VERSION,
        name: name.into(),
        includes: default_includes(),
    }
}

pub fn sample_environments() -> ProjectFile {
    ProjectFile {
        environments: vec![Environment {
            id: "local".to_string(),
            name: "Local".to_string(),
            variables: BTreeMap::from([(
                "base_url".to_string(),
                "https://httpbin.org".to_string(),
            )]),
        }],
        requests: Vec::new(),
    }
}

pub fn sample_requests() -> ProjectFile {
    ProjectFile {
        environments: Vec::new(),
        requests: vec![ApiRequest {
            id: "hello".to_string(),
            name: "Hello HTTPBin".to_string(),
            folder: None,
            method: "GET".to_string(),
            url: "{{base_url}}/get".to_string(),
            headers: BTreeMap::from([("accept".to_string(), "application/json".to_string())]),
            query: BTreeMap::new(),
            auth: None,
            body: RequestBody::None,
            options: RequestOptions::default(),
        }],
    }
}
