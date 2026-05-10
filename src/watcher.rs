//! Watch the user's YAML source files and refresh the SQLite projection when
//! they change on disk. Sends an event after each successful refresh so the
//! UI (or any future subscriber) can react.

use std::path::PathBuf;
use std::sync::mpsc as std_mpsc;
use std::time::{Duration, Instant};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::broadcast;
use tokio::task;
use tracing::{debug, error, info, warn};

use crate::db::Store;
use crate::project::{self, ProjectPaths};

/// Events that the watcher emits after a successful (or failed) reload.
/// Subscribers are not yet wired up to a public endpoint (SSE coming soon),
/// so the fields are documented as part of the public surface even though
/// they look unused to the current dead-code analysis.
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub enum ProjectEvent {
    Reloaded {
        request_count: usize,
        environment_count: usize,
    },
    ReloadFailed(String),
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct ProjectWatcher {
    pub events: broadcast::Sender<ProjectEvent>,
    /// Holds the OS watcher alive for the duration of the server.
    _watcher: RecommendedWatcher,
    /// Holds the debouncer task alive.
    _task: task::JoinHandle<()>,
}

const DEBOUNCE: Duration = Duration::from_millis(250);

pub fn spawn(paths: ProjectPaths, store: Store) -> anyhow::Result<ProjectWatcher> {
    let (raw_tx, raw_rx) = std_mpsc::channel::<notify::Result<Event>>();

    let mut watcher = notify::recommended_watcher(move |res| {
        let _ = raw_tx.send(res);
    })?;

    let watch_paths = watched_paths(&paths);
    for path in &watch_paths {
        if path.exists() {
            if let Err(err) = watcher.watch(path, RecursiveMode::Recursive) {
                warn!(path = %path.display(), error = %err, "failed to watch path");
            }
        }
    }

    let (events_tx, _events_rx) = broadcast::channel::<ProjectEvent>(16);
    let events_for_task = events_tx.clone();
    let task_paths = paths.clone();
    let task_store = store;

    let join = task::spawn_blocking(move || {
        debounce_loop(raw_rx, &task_paths, &task_store, events_for_task);
    });

    Ok(ProjectWatcher {
        events: events_tx,
        _watcher: watcher,
        _task: join,
    })
}

fn watched_paths(paths: &ProjectPaths) -> Vec<PathBuf> {
    let mut out = vec![paths.manifest.clone(), paths.boson_dir.clone()];
    if let Some(parent) = paths.manifest.parent() {
        out.push(parent.to_path_buf());
    }
    out
}

fn debounce_loop(
    rx: std_mpsc::Receiver<notify::Result<Event>>,
    paths: &ProjectPaths,
    store: &Store,
    events: broadcast::Sender<ProjectEvent>,
) {
    let mut pending: Option<Instant> = None;
    loop {
        let next = match pending {
            Some(deadline) => deadline.saturating_duration_since(Instant::now()),
            None => Duration::from_secs(60),
        };

        match rx.recv_timeout(next) {
            Ok(Ok(event)) => {
                if !is_relevant(&event) {
                    continue;
                }
                debug!(?event, "watcher event");
                pending = Some(Instant::now() + DEBOUNCE);
            }
            Ok(Err(err)) => {
                warn!(error = %err, "watcher error");
            }
            Err(std_mpsc::RecvTimeoutError::Timeout) => {
                if let Some(deadline) = pending {
                    if Instant::now() >= deadline {
                        pending = None;
                        refresh(paths, store, &events);
                    }
                }
            }
            Err(std_mpsc::RecvTimeoutError::Disconnected) => {
                debug!("watcher channel disconnected; exiting loop");
                break;
            }
        }
    }
}

fn is_relevant(event: &Event) -> bool {
    matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    ) && event.paths.iter().any(|path| {
        path.extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| matches!(ext, "yml" | "yaml"))
    })
}

fn refresh(paths: &ProjectPaths, store: &Store, events: &broadcast::Sender<ProjectEvent>) {
    match project::load_snapshot(paths) {
        Ok(snapshot) => {
            if let Err(err) = store.replace_snapshot(&snapshot) {
                error!(error = %err, "failed to update SQLite snapshot");
                let _ = events.send(ProjectEvent::ReloadFailed(err.to_string()));
                return;
            }
            info!(
                request_count = snapshot.requests.len(),
                environment_count = snapshot.environments.len(),
                "project reloaded from disk"
            );
            let _ = events.send(ProjectEvent::Reloaded {
                request_count: snapshot.requests.len(),
                environment_count: snapshot.environments.len(),
            });
        }
        Err(err) => {
            warn!(error = %err, "failed to reload project");
            let _ = events.send(ProjectEvent::ReloadFailed(err.to_string()));
        }
    }
}
