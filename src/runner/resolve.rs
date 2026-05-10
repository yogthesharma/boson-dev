//! Pure transformation from a stored `ApiRequest` to a `ResolvedRequest`
//! ready to send. Variable interpolation, secret lookup, and path resolution
//! all happen here so `http::send_request` can stay focused on I/O.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::config::{
    ApiKeyLocation, ApiRequest, Auth, MultipartSource, RequestBody,
};
use crate::secrets::SecretManager;

#[derive(Debug)]
pub(super) struct ResolvedRequest {
    pub method: String,
    pub url: String,
    pub headers: BTreeMap<String, String>,
    pub query: BTreeMap<String, String>,
    pub auth: Option<ResolvedAuth>,
    pub body: ResolvedBody,
}

#[derive(Debug)]
pub(super) enum ResolvedAuth {
    Bearer(String),
    Basic {
        username: String,
        password: String,
    },
    ApiKey {
        name: String,
        value: String,
        location: ApiKeyLocation,
    },
}

#[derive(Debug)]
pub(super) enum ResolvedBody {
    None,
    Text { content_type: String, value: String },
    Form { fields: Vec<(String, String)> },
    Multipart { fields: Vec<ResolvedMultipart> },
}

#[derive(Debug)]
pub(super) struct ResolvedMultipart {
    pub name: String,
    pub kind: ResolvedMultipartKind,
}

#[derive(Debug)]
pub(super) enum ResolvedMultipartKind {
    Text(String),
    File {
        path: PathBuf,
        content_type: Option<String>,
        file_name: Option<String>,
    },
}

pub(super) struct Resolver<'a> {
    pub variables: BTreeMap<String, String>,
    pub secrets: &'a SecretManager,
}

impl Resolver<'_> {
    pub(super) fn resolve(&self, value: &str) -> anyhow::Result<String> {
        let mut out = String::with_capacity(value.len());
        let mut rest = value;
        loop {
            let Some(open) = rest.find("{{") else {
                out.push_str(rest);
                return Ok(out);
            };
            out.push_str(&rest[..open]);
            let after_open = &rest[open + 2..];
            let Some(close) = after_open.find("}}") else {
                out.push_str(&rest[open..]);
                return Ok(out);
            };
            let token = after_open[..close].trim();
            let replacement = self.lookup(token)?;
            out.push_str(&replacement);
            rest = &after_open[close + 2..];
        }
    }

    fn lookup(&self, token: &str) -> anyhow::Result<String> {
        if let Some(name) = token.strip_prefix("secret:") {
            let name = name.trim();
            return match self.secrets.get(name)? {
                Some(value) => Ok(value),
                None => anyhow::bail!("secret `{name}` is not set"),
            };
        }
        if let Some(name) = token.strip_prefix("env:") {
            return Ok(std::env::var(name.trim()).unwrap_or_default());
        }
        Ok(self.variables.get(token).cloned().unwrap_or_default())
    }
}

pub(super) fn resolve_request(
    request: &ApiRequest,
    resolver: &Resolver,
    project_root: &Path,
) -> anyhow::Result<ResolvedRequest> {
    let headers = request
        .headers
        .iter()
        .map(|(k, v)| Ok::<_, anyhow::Error>((k.clone(), resolver.resolve(v)?)))
        .collect::<Result<_, _>>()?;
    let query = request
        .query
        .iter()
        .map(|(k, v)| Ok::<_, anyhow::Error>((k.clone(), resolver.resolve(v)?)))
        .collect::<Result<_, _>>()?;

    let auth = match &request.auth {
        None => None,
        Some(Auth::Bearer { token }) => Some(ResolvedAuth::Bearer(resolver.resolve(token)?)),
        Some(Auth::Basic { username, password }) => Some(ResolvedAuth::Basic {
            username: resolver.resolve(username)?,
            password: resolver.resolve(password)?,
        }),
        Some(Auth::ApiKey {
            name,
            value,
            location,
        }) => Some(ResolvedAuth::ApiKey {
            name: resolver.resolve(name)?,
            value: resolver.resolve(value)?,
            location: *location,
        }),
        Some(Auth::Oauth2 { .. }) => {
            anyhow::bail!(
                "OAuth2 auth is not yet supported by the runner; use a bearer token for now"
            );
        }
    };

    let body = match &request.body {
        RequestBody::None => ResolvedBody::None,
        RequestBody::Text {
            content_type,
            value,
        } => ResolvedBody::Text {
            content_type: content_type
                .clone()
                .unwrap_or_else(|| "text/plain".to_string()),
            value: resolver.resolve(value)?,
        },
        RequestBody::Json { value } => {
            let raw = serde_json::to_string(value)?;
            ResolvedBody::Text {
                content_type: "application/json".to_string(),
                value: resolver.resolve(&raw)?,
            }
        }
        RequestBody::Form { fields } => ResolvedBody::Form {
            fields: fields
                .iter()
                .map(|(k, v)| Ok::<_, anyhow::Error>((k.clone(), resolver.resolve(v)?)))
                .collect::<Result<_, _>>()?,
        },
        RequestBody::Multipart { fields } => {
            let mut parts = Vec::with_capacity(fields.len());
            for field in fields {
                let kind = match &field.source {
                    MultipartSource::Text { value } => {
                        ResolvedMultipartKind::Text(resolver.resolve(value)?)
                    }
                    MultipartSource::File {
                        path,
                        content_type,
                        file_name,
                    } => {
                        let resolved_path = resolver.resolve(path)?;
                        let absolute = if Path::new(&resolved_path).is_absolute() {
                            PathBuf::from(&resolved_path)
                        } else {
                            project_root.join(&resolved_path)
                        };
                        if !absolute.exists() {
                            anyhow::bail!("multipart file does not exist: {}", absolute.display());
                        }
                        ResolvedMultipartKind::File {
                            path: absolute,
                            content_type: content_type.clone(),
                            file_name: file_name.clone(),
                        }
                    }
                };
                parts.push(ResolvedMultipart {
                    name: field.name.clone(),
                    kind,
                });
            }
            ResolvedBody::Multipart { fields: parts }
        }
    };

    Ok(ResolvedRequest {
        method: resolver.resolve(&request.method)?,
        url: resolver.resolve(&request.url)?,
        headers,
        query,
        auth,
        body,
    })
}
