//! Execute a single request against an HTTP endpoint.
//!
//! Inputs come from the SQLite-projected request (drafts override canonical),
//! the selected environment, and the encrypted secret store. Output is a
//! `ResponseHistory` row stored alongside a `Run` row that tracks status and
//! supports cancellation through a `CancellationToken`.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Context;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use tracing::warn;

use crate::config::{
    ApiKeyLocation, ApiRequest, Auth, MultipartSource, RequestBody, RequestOptions,
};
use crate::db::{NewHistory, ResponseHistory, Run, RunStatus, Store};
use crate::secrets::SecretManager;

/// Tracks active cancellation tokens per run-id so a separate API call can
/// cancel an in-flight request.
#[derive(Clone, Default)]
pub struct RunRegistry {
    inner: Arc<Mutex<BTreeMap<String, CancellationToken>>>,
}

impl RunRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn insert(&self, id: String, token: CancellationToken) {
        self.inner.lock().await.insert(id, token);
    }

    pub async fn remove(&self, id: &str) {
        self.inner.lock().await.remove(id);
    }

    pub async fn cancel(&self, id: &str) -> bool {
        let token = self.inner.lock().await.get(id).cloned();
        if let Some(token) = token {
            token.cancel();
            true
        } else {
            false
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RunRequestInput {
    #[serde(default)]
    pub environment_id: Option<String>,
}

#[derive(Clone)]
pub struct RunContext {
    pub store: Store,
    pub secrets: SecretManager,
    pub registry: RunRegistry,
    pub project_root: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct RunOutcome {
    pub run: Run,
    pub history: Option<ResponseHistory>,
}

pub async fn run_request(
    ctx: RunContext,
    run_id: String,
    request_id: String,
    input: RunRequestInput,
) -> anyhow::Result<RunOutcome> {
    ctx.store
        .create_run(&run_id, &request_id, input.environment_id.as_deref())?;

    let token = CancellationToken::new();
    ctx.registry.insert(run_id.clone(), token.clone()).await;

    let result = execute(&ctx, &run_id, &request_id, &input, token).await;
    ctx.registry.remove(&run_id).await;

    let (status, history, error) = match &result {
        Ok(history) => (RunStatus::Completed, Some(history.clone()), None),
        Err(RunError::Canceled) => (RunStatus::Canceled, None, Some("canceled".to_string())),
        Err(RunError::Other(err)) => (RunStatus::Failed, None, Some(err.to_string())),
    };

    ctx.store.mark_run_status(
        &run_id,
        status.clone(),
        history.as_ref().map(|h| h.id),
        error.clone(),
    )?;

    let run = ctx
        .store
        .run(&run_id)?
        .context("run row should exist after marking status")?;

    Ok(RunOutcome { run, history })
}

#[derive(Debug)]
enum RunError {
    Canceled,
    Other(anyhow::Error),
}

impl<E: Into<anyhow::Error>> From<E> for RunError {
    fn from(value: E) -> Self {
        RunError::Other(value.into())
    }
}

async fn execute(
    ctx: &RunContext,
    run_id: &str,
    request_id: &str,
    input: &RunRequestInput,
    token: CancellationToken,
) -> Result<ResponseHistory, RunError> {
    let request = ctx
        .store
        .effective_request(request_id)
        .map_err(RunError::Other)?
        .ok_or_else(|| RunError::Other(anyhow::anyhow!("request `{request_id}` not found")))?;

    let environment = match &input.environment_id {
        Some(id) => ctx.store.environment(id).map_err(RunError::Other)?,
        None => ctx
            .store
            .environments()
            .map_err(RunError::Other)?
            .into_iter()
            .next(),
    };

    let environment_id = environment.as_ref().map(|env| env.id.clone());
    let variables = environment
        .as_ref()
        .map(|env| env.variables.clone())
        .unwrap_or_default();

    let resolver = Resolver {
        variables,
        secrets: &ctx.secrets,
    };

    let resolved =
        resolve_request(&request, &resolver, &ctx.project_root).map_err(RunError::Other)?;

    let started = Instant::now();
    let outcome = tokio::select! {
        biased;
        _ = token.cancelled() => Err(RunError::Canceled),
        result = send_request(&resolved, &request.options) => match result {
            Ok(value) => Ok(value),
            Err(err) => Err(RunError::Other(err)),
        }
    };
    let duration_ms = started.elapsed().as_millis();

    match outcome {
        Ok(result) => {
            let item = NewHistory {
                run_id: run_id.to_string(),
                request_id: request_id.to_string(),
                environment_id,
                method: resolved.method,
                url: resolved.url,
                status: Some(result.status),
                duration_ms,
                response_headers: result.headers,
                response_body: result.body,
                response_truncated: result.truncated,
                error: None,
            };
            ctx.store.insert_history(item).map_err(RunError::Other)
        }
        Err(RunError::Canceled) => Err(RunError::Canceled),
        Err(RunError::Other(err)) => {
            let item = NewHistory {
                run_id: run_id.to_string(),
                request_id: request_id.to_string(),
                environment_id,
                method: request.method,
                url: request.url,
                status: None,
                duration_ms,
                response_headers: serde_json::Value::Object(Default::default()),
                response_body: String::new(),
                response_truncated: false,
                error: Some(err.to_string()),
            };
            ctx.store.insert_history(item).map_err(RunError::Other)?;
            Err(RunError::Other(err))
        }
    }
}

#[derive(Debug)]
struct ResolvedRequest {
    method: String,
    url: String,
    headers: BTreeMap<String, String>,
    query: BTreeMap<String, String>,
    auth: Option<ResolvedAuth>,
    body: ResolvedBody,
}

#[derive(Debug)]
enum ResolvedAuth {
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
enum ResolvedBody {
    None,
    Text { content_type: String, value: String },
    Form { fields: Vec<(String, String)> },
    Multipart { fields: Vec<ResolvedMultipart> },
}

#[derive(Debug)]
struct ResolvedMultipart {
    name: String,
    kind: ResolvedMultipartKind,
}

#[derive(Debug)]
enum ResolvedMultipartKind {
    Text(String),
    File {
        path: PathBuf,
        content_type: Option<String>,
        file_name: Option<String>,
    },
}

#[derive(Debug)]
struct RunResponse {
    status: u16,
    headers: serde_json::Value,
    body: String,
    truncated: bool,
}

struct Resolver<'a> {
    variables: BTreeMap<String, String>,
    secrets: &'a SecretManager,
}

impl Resolver<'_> {
    fn resolve(&self, value: &str) -> anyhow::Result<String> {
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

fn resolve_request(
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

async fn send_request(
    request: &ResolvedRequest,
    options: &RequestOptions,
) -> anyhow::Result<RunResponse> {
    let mut client_builder = reqwest::Client::builder()
        .timeout(Duration::from_millis(options.timeout_ms))
        .redirect(if options.follow_redirects {
            reqwest::redirect::Policy::limited(options.max_redirects)
        } else {
            reqwest::redirect::Policy::none()
        });
    if options.cookies {
        client_builder = client_builder.cookie_store(true);
    }
    let client = client_builder.build()?;

    let method = reqwest::Method::from_bytes(request.method.as_bytes())?;
    let mut builder = client.request(method, &request.url);

    for (key, value) in &request.headers {
        if !key.trim().is_empty() {
            builder = builder.header(key, value);
        }
    }

    if !request.query.is_empty() {
        let pairs: Vec<(&str, &str)> = request
            .query
            .iter()
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();
        builder = builder.query(&pairs);
    }

    if let Some(auth) = &request.auth {
        builder = match auth {
            ResolvedAuth::Bearer(token) => builder.bearer_auth(token),
            ResolvedAuth::Basic { username, password } => {
                builder.basic_auth(username, Some(password))
            }
            ResolvedAuth::ApiKey {
                name,
                value,
                location,
            } => match location {
                ApiKeyLocation::Header => builder.header(name.as_str(), value.as_str()),
                ApiKeyLocation::Query => builder.query(&[(name.as_str(), value.as_str())]),
            },
        };
    }

    builder = match &request.body {
        ResolvedBody::None => builder,
        ResolvedBody::Text {
            content_type,
            value,
        } => builder
            .header(reqwest::header::CONTENT_TYPE, content_type.as_str())
            .body(value.clone()),
        ResolvedBody::Form { fields } => builder.form(fields),
        ResolvedBody::Multipart { fields } => {
            let mut form = reqwest::multipart::Form::new();
            for part in fields {
                form = match &part.kind {
                    ResolvedMultipartKind::Text(value) => {
                        form.text(part.name.clone(), value.clone())
                    }
                    ResolvedMultipartKind::File {
                        path,
                        content_type,
                        file_name,
                    } => {
                        let bytes = tokio::fs::read(path).await.with_context(|| {
                            format!("failed to read multipart file {}", path.display())
                        })?;
                        let display_name = file_name.clone().unwrap_or_else(|| {
                            path.file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("file")
                                .to_string()
                        });
                        let mut part_value =
                            reqwest::multipart::Part::bytes(bytes).file_name(display_name);
                        if let Some(ct) = content_type {
                            part_value = part_value
                                .mime_str(ct)
                                .with_context(|| format!("invalid content type `{ct}`"))?;
                        }
                        form.part(part.name.clone(), part_value)
                    }
                };
            }
            builder.multipart(form)
        }
    };

    let response = builder.send().await?;
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .map(|(key, value)| {
            (
                key.as_str().to_string(),
                serde_json::Value::String(value.to_str().unwrap_or_default().to_string()),
            )
        })
        .collect();

    let mut body = Vec::with_capacity(1024);
    let mut truncated = false;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if body.len() + chunk.len() > options.max_response_bytes {
            let take = options.max_response_bytes.saturating_sub(body.len());
            body.extend_from_slice(&chunk[..take]);
            truncated = true;
            warn!(
                limit = options.max_response_bytes,
                "response body exceeded max_response_bytes; truncating"
            );
            break;
        }
        body.extend_from_slice(&chunk);
    }

    let body_text = match String::from_utf8(body) {
        Ok(text) => text,
        Err(err) => format!("<binary response, {} bytes>", err.into_bytes().len()),
    };

    Ok(RunResponse {
        status,
        headers: serde_json::Value::Object(headers),
        body: body_text,
        truncated,
    })
}
