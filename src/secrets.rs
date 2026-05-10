//! Local secret store.
//!
//! Secrets are encrypted with ChaCha20-Poly1305 using a per-project 32-byte
//! key kept at `.boson/key.bin` (file mode 600 on Unix). The DB only ever
//! stores ciphertext, and the API never returns plaintext to the UI — the
//! runner resolves `{{secret:NAME}}` references just-in-time when executing
//! a request.

use std::fs;
use std::io::Write;
use std::path::Path;

use anyhow::{bail, Context};
use chacha20poly1305::aead::{rand_core::RngCore, Aead, KeyInit, OsRng};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};

use crate::db::Store;

const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;

#[derive(Clone)]
pub struct SecretManager {
    store: Store,
    cipher: ChaCha20Poly1305,
}

impl SecretManager {
    pub fn new(store: Store, key_path: &Path) -> anyhow::Result<Self> {
        let key_bytes = load_or_create_key(key_path)?;
        let cipher = ChaCha20Poly1305::new(Key::from_slice(&key_bytes));
        Ok(Self { store, cipher })
    }

    pub fn set(&self, name: &str, plaintext: &str) -> anyhow::Result<()> {
        if name.trim().is_empty() {
            bail!("secret name must not be empty");
        }
        let mut nonce_bytes = [0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let mut ciphertext = self
            .cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| anyhow::anyhow!("encryption failed: {e}"))?;
        let mut payload = Vec::with_capacity(NONCE_LEN + ciphertext.len());
        payload.extend_from_slice(&nonce_bytes);
        payload.append(&mut ciphertext);

        self.store.upsert_secret(name, &payload)
    }

    pub fn delete(&self, name: &str) -> anyhow::Result<()> {
        self.store.delete_secret(name)
    }

    pub fn list_names(&self) -> anyhow::Result<Vec<String>> {
        self.store.secret_names()
    }

    pub fn get(&self, name: &str) -> anyhow::Result<Option<String>> {
        let Some(payload) = self.store.secret_ciphertext(name)? else {
            return Ok(None);
        };
        if payload.len() < NONCE_LEN {
            bail!("secret `{name}` payload is corrupt");
        }
        let (nonce_bytes, ciphertext) = payload.split_at(NONCE_LEN);
        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("failed to decrypt secret `{name}`: {e}"))?;
        Ok(Some(
            String::from_utf8(plaintext).context("secret is not utf-8")?,
        ))
    }
}

fn load_or_create_key(key_path: &Path) -> anyhow::Result<[u8; KEY_LEN]> {
    if key_path.exists() {
        let bytes =
            fs::read(key_path).with_context(|| format!("failed to read {}", key_path.display()))?;
        if bytes.len() != KEY_LEN {
            bail!(
                "{} has unexpected length {} (want {})",
                key_path.display(),
                bytes.len(),
                KEY_LEN
            );
        }
        let mut out = [0u8; KEY_LEN];
        out.copy_from_slice(&bytes);
        return Ok(out);
    }

    if let Some(parent) = key_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    let mut key = [0u8; KEY_LEN];
    OsRng.fill_bytes(&mut key);

    let mut file = fs::OpenOptions::new();
    file.create_new(true).write(true);

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        file.mode(0o600);
    }

    let mut handle = file
        .open(key_path)
        .with_context(|| format!("failed to create {}", key_path.display()))?;
    handle
        .write_all(&key)
        .with_context(|| format!("failed to write {}", key_path.display()))?;
    Ok(key)
}
