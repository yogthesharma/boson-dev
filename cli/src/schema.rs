//! Strongly-typed mirror of the YAML schema and the JSON wire payload posted to
//! `POST /v1/canonical`. Keeping these in sync with `apps/server/src/lib/canonical.ts`
//! is a manual exercise for now; the doc in `docs/sync-and-overrides.md` is the
//! source of truth.

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

const HTTP_METHODS: &[&str] = &[
    "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
];

/// What we read from `boson.yml`. Loose where it makes the file friendlier to
/// author (e.g. `body` may be missing → defaults to `{ type: "none" }`).
#[derive(Debug, Deserialize)]
pub struct YamlSpec {
    pub workspace: String,
    #[serde(default)]
    pub environments: Vec<YamlEnvironment>,
    #[serde(default)]
    pub requests: Vec<YamlRequest>,
}

#[derive(Debug, Deserialize)]
pub struct YamlEnvironment {
    pub name: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    #[serde(default)]
    pub vars: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct YamlRequest {
    pub id: String,
    pub name: Option<String>,
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub body: Option<YamlBody>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum YamlBody {
    None,
    Json {
        #[serde(default)]
        content: String,
    },
    Xml {
        #[serde(default)]
        content: String,
    },
    Text {
        #[serde(default)]
        content: String,
    },
    Sparql {
        #[serde(default)]
        content: String,
    },
    FormUrlencoded {
        #[serde(default)]
        content: BTreeMap<String, String>,
    },
}

/// Wire payload posted to `POST /v1/canonical`. Mirrors `WorkspacePayload` on
/// the server.
#[derive(Debug, Serialize)]
pub struct WirePayload {
    pub workspace: String,
    pub environments: Vec<WireEnvironment>,
    pub requests: Vec<WireRequest>,
}

#[derive(Debug, Serialize)]
pub struct WireEnvironment {
    pub name: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub vars: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
pub struct WireRequest {
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: BTreeMap<String, String>,
    pub body: serde_json::Value,
}

/// Read + parse `boson.yml` and validate it into a wire payload.
pub fn load(path: &Path) -> Result<WirePayload> {
    let text = std::fs::read_to_string(path)
        .with_context(|| format!("reading {}", path.display()))?;
    let spec: YamlSpec = serde_yaml::from_str(&text)
        .with_context(|| format!("parsing YAML in {}", path.display()))?;
    validate(spec)
}

fn validate(spec: YamlSpec) -> Result<WirePayload> {
    let workspace = spec.workspace.trim();
    if workspace.is_empty() {
        bail!("`workspace` must be non-empty");
    }
    if spec.environments.is_empty() {
        bail!("at least one entry under `environments` is required");
    }

    let mut envs = Vec::with_capacity(spec.environments.len());
    for (i, env) in spec.environments.into_iter().enumerate() {
        if env.name.trim().is_empty() {
            bail!("environments[{i}].name must be non-empty");
        }
        if env.base_url.trim().is_empty() {
            bail!("environments[{i}].baseUrl must be non-empty");
        }
        envs.push(WireEnvironment {
            name: env.name,
            base_url: env.base_url,
            vars: env.vars,
        });
    }

    let mut seen = std::collections::HashSet::new();
    let mut reqs = Vec::with_capacity(spec.requests.len());
    for (i, req) in spec.requests.into_iter().enumerate() {
        let id = req.id.trim();
        if id.is_empty() {
            bail!("requests[{i}].id must be non-empty");
        }
        if !seen.insert(id.to_owned()) {
            bail!("duplicate request id `{id}`");
        }

        let method = req.method.to_uppercase();
        if !HTTP_METHODS.contains(&method.as_str()) {
            bail!(
                "requests[{i}].method `{}` invalid; must be one of {:?}",
                req.method,
                HTTP_METHODS
            );
        }

        if req.url.trim().is_empty() {
            bail!("requests[{i}].url must be non-empty");
        }

        let body_json = body_to_json(req.body.as_ref())
            .ok_or_else(|| anyhow!("requests[{i}].body invalid"))?;

        reqs.push(WireRequest {
            id: id.to_owned(),
            name: req.name.unwrap_or_else(|| id.to_owned()),
            method,
            url: req.url,
            headers: req.headers,
            body: body_json,
        });
    }

    Ok(WirePayload {
        workspace: workspace.to_owned(),
        environments: envs,
        requests: reqs,
    })
}

fn body_to_json(body: Option<&YamlBody>) -> Option<serde_json::Value> {
    use serde_json::json;
    let val = match body {
        None | Some(YamlBody::None) => json!({ "type": "none" }),
        Some(YamlBody::Json { content }) => json!({ "type": "json", "content": content }),
        Some(YamlBody::Xml { content }) => json!({ "type": "xml", "content": content }),
        Some(YamlBody::Text { content }) => json!({ "type": "text", "content": content }),
        Some(YamlBody::Sparql { content }) => json!({ "type": "sparql", "content": content }),
        Some(YamlBody::FormUrlencoded { content }) => {
            json!({ "type": "form-urlencoded", "content": content })
        }
    };
    Some(val)
}
