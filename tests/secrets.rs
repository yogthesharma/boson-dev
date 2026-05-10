//! Encrypted secret storage round-trips through disk + SQLite.

mod common;

use boson::db::Store;
use boson::secrets::SecretManager;
use tempfile::TempDir;

use common::init_project;

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
