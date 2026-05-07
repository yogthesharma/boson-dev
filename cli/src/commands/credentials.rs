//! Persisted CLI credentials (`~/.config/boson/auth.json`).

use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
struct AuthFile {
    token: String,
}

pub fn credentials_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join(".config")
        .join("boson")
        .join("auth.json")
}

pub fn load_token() -> Option<String> {
    let path = credentials_path();
    let data = fs::read_to_string(&path).ok()?;
    let parsed: AuthFile = serde_json::from_str(&data).ok()?;
    let t = parsed.token.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_owned())
    }
}

pub fn save_token(token: &str) -> Result<()> {
    let path = credentials_path();
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).with_context(|| format!("creating {}", dir.display()))?;
    }
    let file = AuthFile {
        token: token.trim().to_owned(),
    };
    let json = serde_json::to_string_pretty(&file).context("serializing auth file")?;
    fs::write(&path, json).with_context(|| format!("writing {}", path.display()))?;
    Ok(())
}
