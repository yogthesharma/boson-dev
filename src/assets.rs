//! Serve the built Vite UI from assets embedded into the binary at compile
//! time. With the `embed-ui` feature disabled, this returns 503 so that you
//! can run the Rust server in fast Rust-only iteration mode.

use axum::body::Body;
#[cfg(feature = "embed-ui")]
use axum::http::{header, HeaderValue};
use axum::http::{Request, StatusCode};
use axum::response::{IntoResponse, Response};

#[cfg(feature = "embed-ui")]
mod embed {
    use rust_embed::RustEmbed;

    /// `web/dist` is the Vite build output, populated by `build.rs`.
    #[derive(RustEmbed)]
    #[folder = "$CARGO_MANIFEST_DIR/web/dist"]
    pub struct Assets;
}

pub async fn serve(req: Request<Body>) -> Response {
    #[cfg(feature = "embed-ui")]
    {
        let path = req.uri().path().trim_start_matches('/');
        if let Some(resp) = serve_embedded(path) {
            return resp;
        }
        // SPA fallback: serve index.html for unknown paths.
        if let Some(resp) = serve_embedded("index.html") {
            return resp;
        }
        let _ = req;
        not_found()
    }

    #[cfg(not(feature = "embed-ui"))]
    {
        let _ = req;
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "UI assets are not embedded in this build.\n\
             Build with default features (`cargo build`) or run `boson dev` instead.\n",
        )
            .into_response()
    }
}

#[cfg(feature = "embed-ui")]
fn serve_embedded(path: &str) -> Option<Response> {
    let lookup = if path.is_empty() { "index.html" } else { path };
    let file = embed::Assets::get(lookup)?;
    let mime = mime_guess::from_path(lookup).first_or_octet_stream();

    let mut response = Response::builder().status(StatusCode::OK);
    if let Ok(value) = HeaderValue::from_str(mime.as_ref()) {
        if let Some(headers) = response.headers_mut() {
            headers.insert(header::CONTENT_TYPE, value);
        }
    }

    let body = Body::from(file.data.into_owned());
    Some(response.body(body).unwrap_or_else(|_| not_found()))
}

#[cfg(feature = "embed-ui")]
fn not_found() -> Response {
    (StatusCode::NOT_FOUND, "not found").into_response()
}
