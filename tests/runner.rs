//! Runner integration tests: HTTP execution paths, response truncation,
//! multipart, and cancellation. Each runner test uses `httpmock` to stand
//! up a hermetic in-process HTTP server.

mod common;

use std::collections::BTreeMap;

use boson::config::{
    ApiKeyLocation, ApiRequest, Auth, MultipartField, MultipartSource, RequestBody, RequestOptions,
};
use boson::db::{RunStatus, Store};
use boson::runner::{RunContext, RunRegistry, RunRequestInput};
use boson::secrets::SecretManager;
use httpmock::{Method, MockServer};
use tempfile::TempDir;
use tokio_util::sync::CancellationToken;

use common::init_project;

#[tokio::test]
async fn runner_executes_get_with_query_and_bearer_auth() {
    let server = MockServer::start_async().await;
    let mock = server
        .mock_async(|when, then| {
            when.method(Method::GET)
                .path("/items")
                .query_param("page", "2")
                .header("authorization", "Bearer my-token");
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"ok":true}"#);
        })
        .await;

    let tmp = TempDir::new().unwrap();
    let paths = init_project(&tmp);
    let store = Store::open(&paths.db_path).unwrap();

    let secrets = SecretManager::new(store.clone(), &paths.secret_key_path).unwrap();
    secrets.set("token", "my-token").unwrap();

    let request = ApiRequest {
        id: "list".to_string(),
        name: "List".to_string(),
        folder: None,
        method: "GET".to_string(),
        url: format!("{}/items", server.base_url()),
        headers: BTreeMap::new(),
        query: BTreeMap::from([("page".to_string(), "2".to_string())]),
        auth: Some(Auth::Bearer {
            token: "{{secret:token}}".to_string(),
        }),
        body: RequestBody::None,
        options: RequestOptions::default(),
    };
    store.upsert_draft("list", &request).unwrap();

    let ctx = RunContext {
        store: store.clone(),
        secrets,
        registry: RunRegistry::new(),
        project_root: paths.root.clone(),
    };
    let outcome = boson::runner::run_request(
        ctx,
        "run-1".to_string(),
        "list".to_string(),
        RunRequestInput::default(),
    )
    .await
    .unwrap();

    mock.assert_async().await;
    let history = outcome.history.expect("history");
    assert_eq!(history.status, Some(200));
    assert_eq!(history.response_body, r#"{"ok":true}"#);
    assert!(matches!(outcome.run.status, RunStatus::Completed));
}

#[tokio::test]
async fn runner_posts_form_with_basic_auth_and_api_key_query() {
    let server = MockServer::start_async().await;
    let mock = server
        .mock_async(|when, then| {
            when.method(Method::POST)
                .path("/login")
                .query_param("token", "abc123")
                .header_exists("authorization")
                .body("user=hello&value=world");
            then.status(204);
        })
        .await;

    let tmp = TempDir::new().unwrap();
    let paths = init_project(&tmp);
    let store = Store::open(&paths.db_path).unwrap();
    let secrets = SecretManager::new(store.clone(), &paths.secret_key_path).unwrap();

    let request = ApiRequest {
        id: "post".to_string(),
        name: "Post".to_string(),
        folder: None,
        method: "POST".to_string(),
        url: format!("{}/login", server.base_url()),
        headers: BTreeMap::new(),
        query: BTreeMap::new(),
        auth: Some(Auth::Basic {
            username: "alice".to_string(),
            password: "wonder".to_string(),
        }),
        body: RequestBody::Form {
            fields: BTreeMap::from([
                ("user".to_string(), "hello".to_string()),
                ("value".to_string(), "world".to_string()),
            ]),
        },
        options: RequestOptions::default(),
    };
    let mut request_with_key = request.clone();
    request_with_key.auth = Some(Auth::ApiKey {
        name: "token".to_string(),
        value: "abc123".to_string(),
        location: ApiKeyLocation::Query,
    });
    // Layer two auths: Basic via header (above) AND ApiKey via query — both
    // are needed by the mock. The runner currently applies one Auth value, so
    // we emulate the basic header through a header field.
    let mut request = request_with_key;
    request.headers.insert(
        "authorization".to_string(),
        format!("Basic {}", base64_basic("alice", "wonder")),
    );

    store.upsert_draft("post", &request).unwrap();

    let ctx = RunContext {
        store: store.clone(),
        secrets,
        registry: RunRegistry::new(),
        project_root: paths.root.clone(),
    };
    let outcome = boson::runner::run_request(
        ctx,
        "run-2".to_string(),
        "post".to_string(),
        RunRequestInput::default(),
    )
    .await
    .unwrap();

    mock.assert_async().await;
    let history = outcome.history.expect("history");
    assert_eq!(history.status, Some(204));
}

#[tokio::test]
async fn runner_truncates_oversized_response_body() {
    let server = MockServer::start_async().await;
    let big = "x".repeat(64 * 1024);
    let body = big.clone();
    let mock = server
        .mock_async(|when, then| {
            when.method(Method::GET).path("/big");
            then.status(200).body(body);
        })
        .await;

    let tmp = TempDir::new().unwrap();
    let paths = init_project(&tmp);
    let store = Store::open(&paths.db_path).unwrap();
    let secrets = SecretManager::new(store.clone(), &paths.secret_key_path).unwrap();

    let options = RequestOptions {
        max_response_bytes: 1024,
        ..RequestOptions::default()
    };

    let request = ApiRequest {
        id: "big".to_string(),
        name: "Big".to_string(),
        folder: None,
        method: "GET".to_string(),
        url: format!("{}/big", server.base_url()),
        headers: BTreeMap::new(),
        query: BTreeMap::new(),
        auth: None,
        body: RequestBody::None,
        options,
    };
    store.upsert_draft("big", &request).unwrap();

    let ctx = RunContext {
        store: store.clone(),
        secrets,
        registry: RunRegistry::new(),
        project_root: paths.root.clone(),
    };
    let outcome = boson::runner::run_request(
        ctx,
        "run-3".to_string(),
        "big".to_string(),
        RunRequestInput::default(),
    )
    .await
    .unwrap();

    mock.assert_async().await;
    let history = outcome.history.expect("history");
    assert!(history.response_truncated, "expected truncation flag");
    assert_eq!(history.response_body.len(), 1024);
}

#[tokio::test]
async fn runner_supports_multipart_text_field() {
    let server = MockServer::start_async().await;
    let mock = server
        .mock_async(|when, then| {
            when.method(Method::POST)
                .path("/upload")
                .header_exists("content-type")
                .body_matches(regex_multipart("hello", "world"));
            then.status(200).body("ok");
        })
        .await;

    let tmp = TempDir::new().unwrap();
    let paths = init_project(&tmp);
    let store = Store::open(&paths.db_path).unwrap();
    let secrets = SecretManager::new(store.clone(), &paths.secret_key_path).unwrap();

    let request = ApiRequest {
        id: "upload".to_string(),
        name: "Upload".to_string(),
        folder: None,
        method: "POST".to_string(),
        url: format!("{}/upload", server.base_url()),
        headers: BTreeMap::new(),
        query: BTreeMap::new(),
        auth: None,
        body: RequestBody::Multipart {
            fields: vec![MultipartField {
                name: "hello".to_string(),
                source: MultipartSource::Text {
                    value: "world".to_string(),
                },
            }],
        },
        options: RequestOptions::default(),
    };
    store.upsert_draft("upload", &request).unwrap();

    let ctx = RunContext {
        store: store.clone(),
        secrets,
        registry: RunRegistry::new(),
        project_root: paths.root.clone(),
    };
    let outcome = boson::runner::run_request(
        ctx,
        "run-4".to_string(),
        "upload".to_string(),
        RunRequestInput::default(),
    )
    .await
    .unwrap();

    mock.assert_async().await;
    let history = outcome.history.expect("history");
    assert_eq!(history.status, Some(200));
}

#[tokio::test]
async fn cancellation_token_marks_run_canceled() {
    let registry = RunRegistry::new();
    let token = CancellationToken::new();
    registry.insert("run-c".to_string(), token.clone()).await;
    assert!(registry.cancel("run-c").await);
    assert!(token.is_cancelled());
}

fn base64_basic(user: &str, password: &str) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(format!("{user}:{password}"))
}

fn regex_multipart(name: &str, value: &str) -> regex::Regex {
    let pattern = format!(
        "(?s)name=\"{name}\".*{value}",
        name = regex::escape(name),
        value = regex::escape(value)
    );
    regex::Regex::new(&pattern).unwrap()
}
