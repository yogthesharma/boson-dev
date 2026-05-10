//! Reverse proxy for the Vite dev server.
//!
//! Handles both regular HTTP requests and WebSocket upgrades (used by Vite's
//! HMR client at `/@vite/client`). The strategy:
//!
//! - If the request has the `Upgrade: websocket` header, accept the upgrade with
//!   axum, open an upstream WS connection to Vite, and shuttle frames in both
//!   directions.
//! - Otherwise, forward the request to Vite over HTTP using `reqwest` and stream
//!   the response back.

use std::net::SocketAddr;

use axum::body::Body;
use axum::extract::ws::{Message as AxumMsg, WebSocket, WebSocketUpgrade};
use axum::extract::FromRequestParts;
use axum::http::{header, HeaderMap, HeaderValue, Method, Request, StatusCode};
use axum::response::{IntoResponse, Response};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::protocol::Message as TungsteniteMsg;
use tracing::{debug, warn};

/// Forward an axum request to the Vite dev server at `upstream`.
pub async fn forward(upstream: SocketAddr, req: Request<Body>) -> Response {
    if is_websocket_upgrade(req.headers()) {
        return upgrade_websocket(upstream, req).await;
    }
    match forward_http(upstream, req).await {
        Ok(resp) => resp,
        Err(err) => {
            warn!(error = %err, "proxy error");
            (StatusCode::BAD_GATEWAY, format!("proxy error: {err}")).into_response()
        }
    }
}

fn is_websocket_upgrade(headers: &HeaderMap) -> bool {
    headers
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.eq_ignore_ascii_case("websocket"))
}

async fn forward_http(upstream: SocketAddr, req: Request<Body>) -> anyhow::Result<Response> {
    let (parts, body) = req.into_parts();

    let path_and_query = parts
        .uri
        .path_and_query()
        .map(|p| p.as_str())
        .unwrap_or("/");
    let upstream_url = format!("http://{upstream}{path_and_query}");

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()?;

    let method = reqwest::Method::from_bytes(parts.method.as_str().as_bytes())?;
    let mut builder = client.request(method, &upstream_url);

    // Copy request headers, dropping hop-by-hop ones.
    for (name, value) in parts.headers.iter() {
        if is_hop_by_hop(name.as_str()) {
            continue;
        }
        builder = builder.header(name.as_str(), value);
    }
    builder = builder.header("host", upstream.to_string());

    if matches!(parts.method, Method::GET | Method::HEAD) {
        // No body.
    } else {
        let bytes = axum::body::to_bytes(body, usize::MAX).await?;
        builder = builder.body(bytes);
    }

    let upstream_resp = builder.send().await?;

    let status = StatusCode::from_u16(upstream_resp.status().as_u16())?;
    let mut response = Response::builder().status(status);

    if let Some(headers) = response.headers_mut() {
        for (name, value) in upstream_resp.headers().iter() {
            if is_hop_by_hop(name.as_str()) {
                continue;
            }
            if let (Ok(n), Ok(v)) = (
                axum::http::HeaderName::from_bytes(name.as_str().as_bytes()),
                HeaderValue::from_bytes(value.as_bytes()),
            ) {
                headers.append(n, v);
            }
        }
    }

    let stream = upstream_resp.bytes_stream();
    let body = Body::from_stream(stream);
    Ok(response.body(body)?)
}

fn is_hop_by_hop(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "connection"
            | "keep-alive"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailers"
            | "transfer-encoding"
            | "upgrade"
            | "host"
            | "content-length"
    )
}

async fn upgrade_websocket(upstream: SocketAddr, req: Request<Body>) -> Response {
    let (mut parts, _body) = req.into_parts();

    // Capture the path+query and selected headers from the incoming request so
    // we can replay them on the upstream connection. This matters for Vite's
    // HMR client, which connects to `/?token=...`.
    let path_and_query = parts
        .uri
        .path_and_query()
        .map(|p| p.as_str().to_string())
        .unwrap_or_else(|| "/".to_string());
    let sec_proto = parts
        .headers
        .get(header::SEC_WEBSOCKET_PROTOCOL)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Hand the upgrade to axum; once the client side handshake completes, we
    // open a parallel client handshake against Vite and pipe the two together.
    match WebSocketUpgrade::from_request_parts(&mut parts, &()).await {
        Ok(mut ws) => {
            if let Some(proto) = sec_proto.clone() {
                ws = ws.protocols(
                    proto
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .collect::<Vec<_>>(),
                );
            }
            ws.on_upgrade(move |client_socket| async move {
                if let Err(e) =
                    bridge_websocket(upstream, &path_and_query, sec_proto, client_socket).await
                {
                    warn!(error = %e, "ws proxy error");
                }
            })
        }
        Err(rej) => rej.into_response(),
    }
}

async fn bridge_websocket(
    upstream: SocketAddr,
    path_and_query: &str,
    sec_proto: Option<String>,
    client_socket: WebSocket,
) -> anyhow::Result<()> {
    let url = format!("ws://{upstream}{path_and_query}");
    let mut req = url.as_str().into_client_request()?;
    if let Some(proto) = sec_proto {
        req.headers_mut().insert(
            header::SEC_WEBSOCKET_PROTOCOL,
            HeaderValue::from_str(&proto)?,
        );
    }

    debug!(url, "opening upstream websocket");
    let (upstream_ws, _resp) = tokio_tungstenite::connect_async(req).await?;

    let (mut up_tx, mut up_rx) = upstream_ws.split();
    let (mut cl_tx, mut cl_rx) = client_socket.split();

    let client_to_upstream = async move {
        while let Some(Ok(msg)) = cl_rx.next().await {
            let out = match msg {
                AxumMsg::Text(t) => TungsteniteMsg::Text(t.as_str().into()),
                AxumMsg::Binary(b) => TungsteniteMsg::Binary(b),
                AxumMsg::Ping(p) => TungsteniteMsg::Ping(p),
                AxumMsg::Pong(p) => TungsteniteMsg::Pong(p),
                AxumMsg::Close(_) => {
                    let _ = up_tx.send(TungsteniteMsg::Close(None)).await;
                    break;
                }
            };
            if up_tx.send(out).await.is_err() {
                break;
            }
        }
    };

    let upstream_to_client = async move {
        while let Some(Ok(msg)) = up_rx.next().await {
            let out = match msg {
                TungsteniteMsg::Text(t) => AxumMsg::Text(t.as_str().into()),
                TungsteniteMsg::Binary(b) => AxumMsg::Binary(b.to_vec().into()),
                TungsteniteMsg::Ping(p) => AxumMsg::Ping(p.to_vec().into()),
                TungsteniteMsg::Pong(p) => AxumMsg::Pong(p.to_vec().into()),
                TungsteniteMsg::Close(_) => {
                    let _ = cl_tx.send(AxumMsg::Close(None)).await;
                    break;
                }
                TungsteniteMsg::Frame(_) => continue,
            };
            if cl_tx.send(out).await.is_err() {
                break;
            }
        }
    };

    tokio::join!(client_to_upstream, upstream_to_client);
    Ok(())
}
