//! HTTP I/O for the runner. Takes a fully-resolved request and returns a
//! captured response (status, headers, body). Streaming is used so we can
//! enforce `max_response_bytes` without buffering oversized payloads.

use std::time::Duration;

use anyhow::Context;
use futures_util::StreamExt;
use tracing::warn;

use crate::config::{ApiKeyLocation, RequestOptions};

use super::resolve::{
    ResolvedAuth, ResolvedBody, ResolvedMultipartKind, ResolvedRequest,
};

#[derive(Debug)]
pub(super) struct RunResponse {
    pub status: u16,
    pub headers: serde_json::Value,
    pub body: String,
    pub truncated: bool,
}

pub(super) async fn send_request(
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
