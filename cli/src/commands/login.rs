use anyhow::{bail, Context, Result};
use serde::Deserialize;

use super::credentials;

const DEFAULT_SERVER: &str = "http://localhost:3001";

#[derive(Debug, Deserialize)]
struct LoginBody {
    ok: bool,
    token: Option<String>,
    user: Option<serde_json::Value>,
    error: Option<String>,
}

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

pub fn run(email: &str, password: &str, server: Option<&str>) -> Result<()> {
    let server = resolve_server(server);
    let url = format!("{}/v1/auth/login", server.trim_end_matches('/'));

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .with_context(|| format!("POST {url}"))?;

    let body: LoginBody = resp
        .json()
        .with_context(|| "parsing login response as JSON")?;

    if body.ok {
        let token = body
            .token
            .filter(|t| !t.trim().is_empty())
            .ok_or_else(|| anyhow::anyhow!("server response missing token"))?;
        credentials::save_token(&token)?;
        let user = body.user.unwrap_or(serde_json::Value::Null);
        println!(
            "logged in as {user}; token saved to {}",
            credentials::credentials_path().display()
        );
        Ok(())
    } else {
        bail!(
            "{}",
            body.error.unwrap_or_else(|| "login failed".to_owned())
        );
    }
}
