//! Integration tests for project loading, the SQLite projection, secrets,
//! and the request runner. The runner tests use `httpmock` to spin up a
//! short-lived HTTP server in the test process so they're hermetic.

use std::collections::BTreeMap;
use std::fs;

use boson::config::{
    ApiKeyLocation, ApiRequest, Auth, MultipartField, MultipartSource, RequestBody, RequestOptions,
};
use boson::db::{RunStatus, Store};
use boson::project::{self, ProjectPaths};
use boson::runner::{RunContext, RunRegistry, RunRequestInput};
use boson::secrets::SecretManager;
use httpmock::Method;
use httpmock::MockServer;
use tempfile::TempDir;
use tokio_util::sync::CancellationToken;

fn init_project(tmp: &TempDir) -> ProjectPaths {
    let paths = project::init(tmp.path(), Some("test".to_string()), false).expect("init project");
    let snapshot = project::load_snapshot(&paths).expect("snapshot");
    let store = Store::open(&paths.db_path).expect("store");
    store.replace_snapshot(&snapshot).expect("replace snapshot");
    paths
}

#[test]
fn init_creates_expected_files() {
    let tmp = TempDir::new().unwrap();
    let paths = project::init(tmp.path(), Some("demo".to_string()), false).unwrap();

    assert!(paths.manifest.exists(), "boson.yml missing");
    assert!(paths.boson_dir.join("environments.yml").exists());
    assert!(paths.boson_dir.join("requests.yml").exists());
    assert!(paths.local_dir.exists());

    let gitignore = fs::read_to_string(paths.root.join(".gitignore")).unwrap();
    assert!(
        gitignore.contains(".boson/"),
        "gitignore should ignore .boson/"
    );
}

#[test]
fn load_snapshot_reads_sample_project() {
    let tmp = TempDir::new().unwrap();
    let paths = project::init(tmp.path(), Some("demo".to_string()), false).unwrap();

    let snapshot = project::load_snapshot(&paths).unwrap();
    assert_eq!(snapshot.manifest.schema_version, 2);
    assert_eq!(snapshot.environments.len(), 1);
    assert_eq!(snapshot.requests.len(), 1);
    assert!(snapshot.request_sources.contains_key("hello"));
}

#[test]
fn duplicate_request_ids_are_rejected() {
    let tmp = TempDir::new().unwrap();
    let paths = project::init(tmp.path(), Some("demo".to_string()), false).unwrap();

    let extra_dir = paths.boson_dir.join("requests");
    fs::create_dir_all(&extra_dir).unwrap();
    fs::write(
        extra_dir.join("dup.yml"),
        "requests:\n  - id: hello\n    name: dup\n    method: GET\n    url: https://example.com\n",
    )
    .unwrap();

    let err = project::load_snapshot(&paths).unwrap_err();
    let message = format!("{err}");
    assert!(
        message.contains("duplicate request id"),
        "unexpected error: {message}"
    );
}

#[test]
fn multi_file_globs_merge_correctly() {
    let tmp = TempDir::new().unwrap();
    let paths = project::init(tmp.path(), Some("demo".to_string()), false).unwrap();

    let env_dir = paths.boson_dir.join("environments");
    let req_dir = paths.boson_dir.join("requests");
    fs::create_dir_all(&env_dir).unwrap();
    fs::create_dir_all(&req_dir).unwrap();
    fs::write(
        env_dir.join("staging.yml"),
        "environments:\n  - id: staging\n    name: Staging\n    variables:\n      base_url: https://staging.example.com\n",
    )
    .unwrap();
    fs::write(
        req_dir.join("login.yml"),
        "requests:\n  - id: login\n    name: Login\n    method: POST\n    url: \"{{base_url}}/login\"\n",
    )
    .unwrap();

    let snapshot = project::load_snapshot(&paths).unwrap();
    let env_ids: Vec<_> = snapshot.environments.iter().map(|e| e.id.clone()).collect();
    let request_ids: Vec<_> = snapshot.requests.iter().map(|r| r.id.clone()).collect();
    assert!(env_ids.contains(&"local".to_string()));
    assert!(env_ids.contains(&"staging".to_string()));
    assert!(request_ids.contains(&"hello".to_string()));
    assert!(request_ids.contains(&"login".to_string()));
}

#[test]
fn drafts_become_stale_when_canonical_changes() {
    let tmp = TempDir::new().unwrap();
    let paths = init_project(&tmp);
    let store = Store::open(&paths.db_path).unwrap();

    let mut hello = store
        .effective_request("hello")
        .unwrap()
        .expect("hello exists");
    hello.name = "Local edit".to_string();
    store.upsert_draft("hello", &hello).unwrap();

    let view = store.project_view().unwrap();
    assert!(
        view.stale_drafts.is_empty(),
        "draft should not be stale yet"
    );

    // Simulate an external edit to the YAML and reproject.
    fs::write(
        paths.boson_dir.join("requests.yml"),
        "requests:\n  - id: hello\n    name: External edit\n    method: GET\n    url: https://example.com\n",
    )
    .unwrap();
    let snapshot = project::load_snapshot(&paths).unwrap();
    store.replace_snapshot(&snapshot).unwrap();

    let view = store.project_view().unwrap();
    assert_eq!(view.stale_drafts, vec!["hello".to_string()]);
}

#[test]
fn secrets_round_trip_via_disk() {
    let tmp = TempDir::new().unwrap();
    let paths = init_project(&tmp);
    let store = Store::open(&paths.db_path).unwrap();

    let manager = SecretManager::new(store.clone(), &paths.secret_key_path).unwrap();
    manager.set("token", "shhh-its-secret").unwrap();
    assert_eq!(
        manager.get("token").unwrap().as_deref(),
        Some("shhh-its-secret")
    );

    // Re-open the manager to confirm the persisted key still decrypts.
    let manager2 = SecretManager::new(store, &paths.secret_key_path).unwrap();
    assert_eq!(
        manager2.get("token").unwrap().as_deref(),
        Some("shhh-its-secret")
    );

    // Names list never includes ciphertext.
    assert_eq!(manager2.list_names().unwrap(), vec!["token".to_string()]);
}

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
