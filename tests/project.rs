//! Project loading: init, snapshot reads, glob merging, duplicate detection,
//! and draft drift detection.

mod common;

use std::fs;

use boson::db::Store;
use boson::project;
use tempfile::TempDir;

use common::init_project;

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
