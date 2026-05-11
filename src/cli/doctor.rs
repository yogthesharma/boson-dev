//! `boson doctor` — lightweight local diagnostics with actionable fixes.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener};
use std::path::Path;
use std::process::Command;

use crate::project;

use super::args::DoctorArgs;

#[derive(Clone, Copy)]
enum CheckState {
    Ok,
    Warn,
}

struct CheckResult {
    name: String,
    state: CheckState,
    detail: String,
    fix: Option<String>,
}

pub(super) fn doctor_cmd(args: DoctorArgs) -> anyhow::Result<()> {
    let mut checks = Vec::new();

    checks.push(check_command("node", &["--version"], "install Node.js: https://nodejs.org/en/download"));
    checks.push(check_command(
        "pnpm",
        &["--version"],
        "install pnpm: npm install -g pnpm",
    ));
    checks.push(check_command("curl", &["--version"], "install curl via your system package manager"));
    checks.push(check_command("tar", &["--version"], "install tar via your system package manager"));

    checks.push(check_path_writable(&args.project_dir, "project directory"));
    checks.push(check_path_writable(&args.web_dir, "web directory"));
    checks.push(check_system_temp_dir());

    checks.push(check_port_free(args.port, "boson server"));
    checks.push(check_port_free(args.vite_port, "vite dev server"));
    checks.push(check_port_free(args.example_api_port, "example API server"));

    checks.extend(check_project_validity(&args.project_dir));

    let mut ok = 0usize;
    let mut warn = 0usize;
    println!("Boson Doctor");
    println!();
    for result in &checks {
        match result.state {
            CheckState::Ok => {
                ok += 1;
                println!("  [ok]   {}: {}", result.name, result.detail);
            }
            CheckState::Warn => {
                warn += 1;
                println!("  [warn] {}: {}", result.name, result.detail);
                if let Some(fix) = &result.fix {
                    println!("         fix: {fix}");
                }
            }
        }
    }

    println!();
    println!("Summary: {ok} ok, {warn} warnings");
    if warn > 0 {
        println!("Some checks need attention before a smooth local run.");
    }
    Ok(())
}

fn check_command(binary: &str, args: &[&str], fix: &str) -> CheckResult {
    match Command::new(binary).args(args).output() {
        Ok(output) if output.status.success() => {
            let mut detail = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if detail.is_empty() {
                detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            }
            if detail.is_empty() {
                detail = "available".to_string();
            }
            CheckResult {
                name: format!("command `{binary}`"),
                state: CheckState::Ok,
                detail,
                fix: None,
            }
        }
        Ok(output) => CheckResult {
            name: format!("command `{binary}`"),
            state: CheckState::Warn,
            detail: format!("found but returned non-zero status ({})", output.status),
            fix: Some(fix.to_string()),
        },
        Err(_) => CheckResult {
            name: format!("command `{binary}`"),
            state: CheckState::Warn,
            detail: "not found in PATH".to_string(),
            fix: Some(fix.to_string()),
        },
    }
}

fn check_path_writable(path: &Path, label: &str) -> CheckResult {
    if !path.exists() {
        return CheckResult {
            name: label.to_string(),
            state: CheckState::Warn,
            detail: format!("{} does not exist", path.display()),
            fix: Some(format!("create it: mkdir -p {}", shell_escape_path(path))),
        };
    }

    let mut target = path.to_path_buf();
    if target.is_file() {
        if let Some(parent) = target.parent() {
            target = parent.to_path_buf();
        }
    }

    let probe = target.join(".boson-doctor-write-test");
    let writable = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&probe)
        .and_then(|mut file| file.write_all(b"ok"))
        .and_then(|_| fs::remove_file(&probe));

    match writable {
        Ok(_) => CheckResult {
            name: label.to_string(),
            state: CheckState::Ok,
            detail: format!("writable ({})", target.display()),
            fix: None,
        },
        Err(err) => CheckResult {
            name: label.to_string(),
            state: CheckState::Warn,
            detail: format!("not writable ({}): {}", target.display(), err),
            fix: Some(format!("adjust permissions: chmod -R u+rwX {}", shell_escape_path(&target))),
        },
    }
}

fn check_system_temp_dir() -> CheckResult {
    let tmp = std::env::temp_dir();
    check_path_writable(&tmp, "system temp directory")
}

fn check_port_free(port: u16, label: &str) -> CheckResult {
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
    match TcpListener::bind(addr) {
        Ok(listener) => {
            drop(listener);
            CheckResult {
                name: format!("port {port} ({label})"),
                state: CheckState::Ok,
                detail: "free".to_string(),
                fix: None,
            }
        }
        Err(err) => CheckResult {
            name: format!("port {port} ({label})"),
            state: CheckState::Warn,
            detail: format!("in use or unavailable: {err}"),
            fix: Some(format!(
                "find the process: lsof -nP -iTCP:{port} -sTCP:LISTEN"
            )),
        },
    }
}

fn check_project_validity(project_dir: &Path) -> Vec<CheckResult> {
    let mut out = Vec::new();
    match project::discover(Some(project_dir)) {
        Ok(paths) => {
            out.push(CheckResult {
                name: "project discovery".to_string(),
                state: CheckState::Ok,
                detail: format!("found boson project at {}", paths.root.display()),
                fix: None,
            });
            match project::load_snapshot(&paths) {
                Ok(snapshot) => out.push(CheckResult {
                    name: "project snapshot".to_string(),
                    state: CheckState::Ok,
                    detail: format!(
                        "loaded {} environments and {} requests",
                        snapshot.environments.len(),
                        snapshot.requests.len()
                    ),
                    fix: None,
                }),
                Err(err) => out.push(CheckResult {
                    name: "project snapshot".to_string(),
                    state: CheckState::Warn,
                    detail: format!("{:#}", err),
                    fix: Some("fix YAML errors and run: boson lint --project-dir <path>".to_string()),
                }),
            }
        }
        Err(err) => out.push(CheckResult {
            name: "project discovery".to_string(),
            state: CheckState::Warn,
            detail: format!("{:#}", err),
            fix: Some(
                "point to a valid project: boson doctor --project-dir <path> (or initialize one: boson init <path>)"
                    .to_string(),
            ),
        }),
    }
    out
}

fn shell_escape_path(path: &Path) -> String {
    let value = path.display().to_string();
    if value.contains(' ') {
        format!("\"{value}\"")
    } else {
        value
    }
}
