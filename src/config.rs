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

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

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
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Auth {
    Bearer {
        token: String,
    },
    Basic {
        username: String,
        password: String,
    },
    ApiKey {
        name: String,
        value: String,
        #[serde(default)]
        location: ApiKeyLocation,
    },
    /// Reserved for a future implementation. Currently runner returns an error.
    Oauth2 {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        token: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ApiKeyLocation {
    #[default]
    Header,
    Query,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum RequestBody {
    #[default]
    None,
    Text {
        content_type: Option<String>,
        value: String,
    },
    Json {
        value: serde_json::Value,
    },
    Form {
        fields: BTreeMap<String, String>,
    },
    Multipart {
        fields: Vec<MultipartField>,
    },
}

impl RequestBody {
    pub fn is_none(&self) -> bool {
        matches!(self, RequestBody::None)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MultipartField {
    pub name: String,
    // `deny_unknown_fields` doesn't compose with `flatten`, so we don't apply
    // it on this struct. The flattened tag still narrows shape via the inner
    // enum.
    #[serde(flatten)]
    pub source: MultipartSource,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum MultipartSource {
    Text {
        value: String,
    },
    File {
        /// Path relative to the project root.
        path: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        content_type: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        file_name: Option<String>,
    },
}

// Custom serde for RequestBody so users can write `body: "raw text"` and the
// API can keep emitting backward-compatible plain-text bodies for the legacy UI.
impl Serialize for RequestBody {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        match self {
            RequestBody::None => ser.serialize_none(),
            RequestBody::Text {
                content_type: None,
                value,
            } => ser.serialize_str(value),
            RequestBody::Text {
                content_type,
                value,
            } => {
                use serde::ser::SerializeMap;
                let mut map = ser.serialize_map(Some(3))?;
                map.serialize_entry("kind", "text")?;
                map.serialize_entry("content_type", content_type)?;
                map.serialize_entry("value", value)?;
                map.end()
            }
            RequestBody::Json { value } => {
                use serde::ser::SerializeMap;
                let mut map = ser.serialize_map(Some(2))?;
                map.serialize_entry("kind", "json")?;
                map.serialize_entry("value", value)?;
                map.end()
            }
            RequestBody::Form { fields } => {
                use serde::ser::SerializeMap;
                let mut map = ser.serialize_map(Some(2))?;
                map.serialize_entry("kind", "form")?;
                map.serialize_entry("fields", fields)?;
                map.end()
            }
            RequestBody::Multipart { fields } => {
                use serde::ser::SerializeMap;
                let mut map = ser.serialize_map(Some(2))?;
                map.serialize_entry("kind", "multipart")?;
                map.serialize_entry("fields", fields)?;
                map.end()
            }
        }
    }
}

impl<'de> Deserialize<'de> for RequestBody {
    fn deserialize<D: serde::Deserializer<'de>>(de: D) -> Result<Self, D::Error> {
        struct V;
        impl<'de> serde::de::Visitor<'de> for V {
            type Value = RequestBody;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("null, a string, or a tagged body object")
            }
            fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                Ok(RequestBody::None)
            }
            fn visit_none<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                Ok(RequestBody::None)
            }
            fn visit_some<D: serde::Deserializer<'de>>(
                self,
                de: D,
            ) -> Result<Self::Value, D::Error> {
                de.deserialize_any(V)
            }
            fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
                Ok(RequestBody::Text {
                    content_type: None,
                    value: v.to_string(),
                })
            }
            fn visit_string<E: serde::de::Error>(self, v: String) -> Result<Self::Value, E> {
                Ok(RequestBody::Text {
                    content_type: None,
                    value: v,
                })
            }
            fn visit_map<A: serde::de::MapAccess<'de>>(
                self,
                map: A,
            ) -> Result<Self::Value, A::Error> {
                #[derive(Deserialize)]
                #[serde(tag = "kind", rename_all = "snake_case")]
                enum Tagged {
                    Text {
                        #[serde(default)]
                        content_type: Option<String>,
                        #[serde(default)]
                        value: String,
                    },
                    Json {
                        value: serde_json::Value,
                    },
                    Form {
                        #[serde(default)]
                        fields: BTreeMap<String, String>,
                    },
                    Multipart {
                        #[serde(default)]
                        fields: Vec<MultipartField>,
                    },
                }
                let de = serde::de::value::MapAccessDeserializer::new(map);
                Ok(match Tagged::deserialize(de)? {
                    Tagged::Text {
                        content_type,
                        value,
                    } => RequestBody::Text {
                        content_type,
                        value,
                    },
                    Tagged::Json { value } => RequestBody::Json { value },
                    Tagged::Form { fields } => RequestBody::Form { fields },
                    Tagged::Multipart { fields } => RequestBody::Multipart { fields },
                })
            }
        }
        de.deserialize_any(V)
    }
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
