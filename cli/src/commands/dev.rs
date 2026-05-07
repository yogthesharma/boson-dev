use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Deserialize;
use sha2::{Digest, Sha256};

use super::credentials;
use crate::schema;

const DEFAULT_SERVER: &str = "http://localhost:3001";

fn resolve_server(cli_arg: Option<&str>) -> String {
    if let Some(s) = cli_arg {
        return s.to_owned();
    }
    if let Ok(s) = std::env::var("BOSON_SERVER_URL") {
        if !s.trim().is_empty() {
            return s;
        }
    }
    DEFAULT_SERVER.to_owned()
}

fn yaml_hash(path: &Path) -> Result<String> {
    let bytes = std::fs::read(path).with_context(|| format!("reading {}", path.display()))?;
    Ok(hex::encode(Sha256::digest(&bytes)))
}

#[derive(Debug, Deserialize)]
struct DraftResponse {
    ok: bool,
    unchanged: Option<bool>,
    error: Option<String>,
}

fn post_draft(server: &str, payload: &schema::WirePayload, hash: &str) -> Result<bool> {
    let url = format!("{}/v1/drafts", server.trim_end_matches('/'));
    let client = reqwest::blocking::Client::new();
    let body = serde_json::json!({ "payload": payload, "hash": hash });
    let mut req = client.post(&url).json(&body);
    if let Some(token) = credentials::load_token() {
        req = req.header("Authorization", format!("Bearer {token}"));
    }
    let resp = req.send().with_context(|| format!("POST {url}"))?;
    let status = resp.status();
    let text = resp.text().with_context(|| "reading draft response body")?;
    let parsed: DraftResponse =
        serde_json::from_str(&text).with_context(|| format!("invalid JSON: {text}"))?;
    if !parsed.ok {
        anyhow::bail!(
            "{}",
            parsed
                .error
                .unwrap_or_else(|| format!("HTTP {status}"))
        );
    }
    Ok(parsed.unchanged.unwrap_or(false))
}

fn delete_drafts(server: &str) -> Result<()> {
    let url = format!("{}/v1/drafts", server.trim_end_matches('/'));
    let client = reqwest::blocking::Client::new();
    let mut req = client.delete(&url);
    if let Some(token) = credentials::load_token() {
        req = req.header("Authorization", format!("Bearer {token}"));
    }
    let resp = req.send().with_context(|| format!("DELETE {url}"))?;
    let status = resp.status();
    if !status.is_success() {
        let t = resp.text().unwrap_or_default();
        anyhow::bail!("DELETE drafts failed: {status} {t}");
    }
    Ok(())
}

pub fn run(file: &Path, server: Option<&str>, reset: bool) -> Result<()> {
    let server = resolve_server(server);
    if reset {
        delete_drafts(&server)?;
        println!("server draft cleared.");
        return Ok(());
    }

    let hash = yaml_hash(file)?;
    let payload = schema::load(file)
        .with_context(|| format!("validating {}", file.display()))?;
    let unchanged = post_draft(&server, &payload, &hash)?;
    if unchanged {
        println!("draft unchanged (hash hit).");
    } else {
        println!("draft uploaded to server.");
    }
    println!("watching {} — Ctrl-C clears the server draft and exits.", file.display());

    let server_bg = Arc::new(server.clone());
    let s_cleanup = Arc::clone(&server_bg);
    let _ = ctrlc::set_handler(move || {
        let _ = delete_drafts(&s_cleanup);
        std::process::exit(0);
    });

    let (tx, rx) = channel();
    let mut watcher = RecommendedWatcher::new(
        move |res| {
            let _ = tx.send(res);
        },
        Config::default(),
    )
    .context("starting file watcher")?;

    let watch_path = file
        .canonicalize()
        .unwrap_or_else(|_| file.to_path_buf());
    let parent: PathBuf = watch_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    watcher
        .watch(&parent, RecursiveMode::NonRecursive)
        .with_context(|| format!("watching {}", parent.display()))?;

    let target_name = watch_path.file_name().map(PathBuf::from);

    loop {
        match rx.recv() {
            Ok(Ok(event)) => {
                let relevant = target_name.as_ref().map_or(false, |want| {
                    event.paths.iter().any(|p| p.file_name() == Some(want.as_os_str()))
                });
                if !relevant {
                    continue;
                }
                std::thread::sleep(Duration::from_millis(350));
                while rx.try_recv().is_ok() {}

                let h = match yaml_hash(file) {
                    Ok(x) => x,
                    Err(e) => {
                        eprintln!("read error: {e:#}");
                        continue;
                    }
                };
                let p = match schema::load(file) {
                    Ok(x) => x,
                    Err(e) => {
                        eprintln!("validation error: {e:#}");
                        continue;
                    }
                };
                match post_draft(&server, &p, &h) {
                    Ok(true) => {}
                    Ok(false) => println!("draft updated"),
                    Err(e) => eprintln!("draft sync error: {e:#}"),
                }
            }
            Ok(Err(e)) => eprintln!("watch error: {e}"),
            Err(_) => break,
        }
    }

    Ok(())
}
