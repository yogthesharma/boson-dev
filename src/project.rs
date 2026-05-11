//! Project on-disk layout, init, discovery, glob-include loading, and writing
//! drafts back to YAML.
//!
//! ```text
//! user-repo/
//! ├── boson.yml                # commit
//! ├── LLM.md                   # optional, commit if useful
//! ├── boson/
//! │   ├── environments.yml
//! │   └── requests.yml
//! └── .boson/                  # gitignored: local DB + key (not “collection” YAML)
//! ```

use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context};

use crate::config::{
    sample_environments, sample_manifest, sample_requests, ApiRequest, BosonManifest, Environment,
    ProjectFile, ProjectSnapshot, SCHEMA_VERSION,
};

#[derive(Debug, Clone)]
pub struct ProjectPaths {
    pub root: PathBuf,
    pub manifest: PathBuf,
    pub boson_dir: PathBuf,
    pub local_dir: PathBuf,
    pub db_path: PathBuf,
    pub secret_key_path: PathBuf,
}

impl ProjectPaths {
    pub fn new(root: PathBuf) -> Self {
        let manifest = root.join("boson.yml");
        let boson_dir = root.join("boson");
        let local_dir = root.join(".boson");
        let db_path = local_dir.join("state.db");
        let secret_key_path = local_dir.join("key.bin");
        Self {
            root,
            manifest,
            boson_dir,
            local_dir,
            db_path,
            secret_key_path,
        }
    }
}

pub fn init(root: &Path, name: Option<String>, force: bool) -> anyhow::Result<ProjectPaths> {
    fs::create_dir_all(root).with_context(|| format!("failed to create {}", root.display()))?;
    let root = root
        .canonicalize()
        .with_context(|| format!("failed to resolve {}", root.display()))?;
    let paths = ProjectPaths::new(root);

    if paths.manifest.exists() && !force {
        bail!(
            "{} already exists. Re-run with --force to overwrite the sample files.",
            paths.manifest.display()
        );
    }

    fs::create_dir_all(&paths.boson_dir)
        .with_context(|| format!("failed to create {}", paths.boson_dir.display()))?;
    fs::create_dir_all(&paths.local_dir)
        .with_context(|| format!("failed to create {}", paths.local_dir.display()))?;

    let project_name = name.unwrap_or_else(|| {
        paths
            .root
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("boson-project")
            .to_string()
    });

    write_yaml(&paths.manifest, &sample_manifest(project_name.clone()))?;
    write_yaml(
        &paths.boson_dir.join("environments.yml"),
        &sample_environments(),
    )?;
    write_yaml(&paths.boson_dir.join("requests.yml"), &sample_requests())?;
    ensure_gitignore_entry(&paths.root)?;
    write_llm_md(&paths, &project_name)?;

    Ok(paths)
}

fn write_llm_md(paths: &ProjectPaths, project_name: &str) -> anyhow::Result<()> {
    let path = paths.root.join("LLM.md");
    let body = format!(
        r#"# {project_name} — Boson project (for humans & coding agents)

This directory is a **Boson** HTTP client project: request collections and environments live in **YAML** on disk; the `boson` CLI serves a local UI and runs requests.

## What to edit (commit these)

| Path | Role |
|------|------|
| `boson.yml` | Manifest: `name`, `schema_version`, `includes` (glob patterns for more YAML) |
| `LLM.md` | Optional notes for humans / coding agents (this file) |
| `boson/environments.yml` | Environment ids, base URLs, `variables` maps |
| `boson/requests.yml` (or `boson/requests/**/*.yml`) | HTTP requests: `id`, `method`, `url`, `headers`, `query`, `auth`, `body`, `options` |

**Local only (gitignored):** `.boson/` holds SQLite + an encryption key for drafts, history, and **encrypted** secrets — not part of your YAML “collection”. Do not commit.

## Editing rules

- **Commit** `boson.yml` and everything under `boson/` you want shared.
- **Never** put API secrets in YAML plaintext. Use `{{{{secret:NAME}}}}` in URLs/headers/body; values are stored encrypted in `.boson/state.db`.
- Use `{{{{variable_name}}}}` for non-secret substitution from the active environment's `variables` map.
- Request `id` must be unique across all included files. `folder` groups the sidebar (e.g. `Group/Sub`).

## Schema

- `boson.yml` must set `schema_version: {schema}` (this project matches the Boson version that created it).
- Request/auth/body shapes are defined in the Boson source tree under `src/config/` (e.g. `body` may be tagged `json`, `form`, `multipart`, `text`).

## Commands (run from this directory)

```bash
boson lint --project-dir .
boson serve --project-dir .          # embedded UI + API
boson run <request_id> --project-dir .
boson doctor --project-dir .         # local checks; add --strict for CI
```

## For coding agents

When adding or changing requests:

1. Prefer small edits to the right YAML file; preserve existing `id` values unless renaming intentionally.
2. After edits, suggest the user run `boson lint` or open the UI to validate.
3. If the user needs live React HMR, they need the Boson **application** repo's `web/` tree — not generated here. Default workflow is `boson serve`.

---
*Generated by `boson init`. Safe to edit or delete; regenerate with `boson init --force` only if you accept overwriting sample YAML too.*
"#,
        project_name = project_name,
        schema = SCHEMA_VERSION,
    );
    fs::write(&path, body).with_context(|| format!("failed to write {}", path.display()))
}

pub fn discover(start: Option<&Path>) -> anyhow::Result<ProjectPaths> {
    let mut dir = match start {
        Some(path) => {
            if path.is_file() {
                path.parent()
                    .map(Path::to_path_buf)
                    .unwrap_or_else(|| PathBuf::from("."))
            } else {
                path.to_path_buf()
            }
        }
        None => env::current_dir().context("failed to read current directory")?,
    };

    if !dir.exists() {
        bail!("{} does not exist", dir.display());
    }
    dir = dir
        .canonicalize()
        .with_context(|| format!("failed to resolve {}", dir.display()))?;

    let mut cursor = Some(dir.as_path());
    while let Some(candidate) = cursor {
        if candidate.join("boson.yml").exists() {
            return Ok(ProjectPaths::new(candidate.to_path_buf()));
        }
        cursor = candidate.parent();
    }

    bail!("no boson.yml found. Run `boson init` first.")
}

pub fn load_snapshot(paths: &ProjectPaths) -> anyhow::Result<ProjectSnapshot> {
    let manifest: BosonManifest = read_yaml(&paths.manifest)?;
    if manifest.schema_version != SCHEMA_VERSION {
        bail!(
            "{}: schema_version {} is unsupported (this build expects {}). \
             Re-run `boson init --force` to regenerate the sample files.",
            display_relative(&paths.manifest, &paths.root),
            manifest.schema_version,
            SCHEMA_VERSION,
        );
    }

    let mut environments: Vec<Environment> = Vec::new();
    let mut requests: Vec<ApiRequest> = Vec::new();
    let mut request_sources: BTreeMap<String, String> = BTreeMap::new();
    let mut env_ids: BTreeSet<String> = BTreeSet::new();
    let mut request_ids: BTreeSet<String> = BTreeSet::new();

    let files = expand_includes(&paths.root, &manifest.includes)?;
    for file in &files {
        let parsed: ProjectFile = read_yaml(file)?;
        let display = display_relative(file, &paths.root);

        for environment in parsed.environments {
            if !env_ids.insert(environment.id.clone()) {
                bail!("{}: duplicate environment id `{}`", display, environment.id);
            }
            environments.push(environment);
        }

        for request in parsed.requests {
            if !request_ids.insert(request.id.clone()) {
                bail!("{}: duplicate request id `{}`", display, request.id);
            }
            request_sources.insert(request.id.clone(), display.clone());
            requests.push(request);
        }
    }

    Ok(ProjectSnapshot {
        manifest,
        environments,
        requests,
        request_sources,
    })
}

/// Save a single request back to the YAML file it originated from. New
/// requests (no source recorded) go to `boson/requests.yml`.
pub fn save_request(paths: &ProjectPaths, request: &ApiRequest) -> anyhow::Result<PathBuf> {
    let snapshot = load_snapshot(paths)?;
    let target_relative = snapshot
        .request_sources
        .get(&request.id)
        .cloned()
        .unwrap_or_else(|| "boson/requests.yml".to_string());
    let target = paths.root.join(&target_relative);

    let mut file: ProjectFile = if target.exists() {
        read_yaml(&target)?
    } else {
        ProjectFile::default()
    };

    let mut replaced = false;
    for existing in &mut file.requests {
        if existing.id == request.id {
            *existing = request.clone();
            replaced = true;
            break;
        }
    }
    if !replaced {
        file.requests.push(request.clone());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }
    write_yaml(&target, &file)?;
    Ok(target)
}

fn ensure_gitignore_entry(root: &Path) -> anyhow::Result<()> {
    let path = root.join(".gitignore");
    let entry = ".boson/";

    if !path.exists() {
        fs::write(&path, format!("{entry}\n"))
            .with_context(|| format!("failed to write {}", path.display()))?;
        return Ok(());
    }

    let contents =
        fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?;
    if !contents.lines().any(|line| line.trim() == entry) {
        let separator = if contents.ends_with('\n') { "" } else { "\n" };
        fs::write(&path, format!("{contents}{separator}{entry}\n"))
            .with_context(|| format!("failed to update {}", path.display()))?;
    }

    Ok(())
}

pub fn write_yaml<T: serde::Serialize>(path: &Path, value: &T) -> anyhow::Result<()> {
    let contents = serde_yaml::to_string(value)
        .with_context(|| format!("failed to serialize YAML for {}", path.display()))?;
    fs::write(path, contents).with_context(|| format!("failed to write {}", path.display()))
}

fn read_yaml<T: for<'de> serde::Deserialize<'de>>(path: &Path) -> anyhow::Result<T> {
    let contents =
        fs::read_to_string(path).with_context(|| format!("failed to read {}", path.display()))?;
    serde_yaml::from_str(&contents)
        .with_context(|| format!("failed to parse YAML in {}", path.display()))
}

/// Resolve the `manifest.includes` glob patterns against the project root,
/// returning a deterministically-sorted list of absolute file paths. Patterns
/// that match nothing are skipped silently (they often serve as "either / or"
/// alternatives, e.g. `boson/environments.yml` vs the directory form).
fn expand_includes(root: &Path, patterns: &[String]) -> anyhow::Result<Vec<PathBuf>> {
    let mut out: BTreeSet<PathBuf> = BTreeSet::new();
    for pattern in patterns {
        let absolute = if Path::new(pattern).is_absolute() {
            pattern.clone()
        } else {
            root.join(pattern).to_string_lossy().into_owned()
        };
        for entry in
            glob::glob(&absolute).with_context(|| format!("invalid include glob `{pattern}`"))?
        {
            match entry {
                Ok(path) if path.is_file() => {
                    out.insert(path);
                }
                Ok(_) => {}
                Err(err) => return Err(anyhow::Error::new(err)),
            }
        }
    }
    Ok(out.into_iter().collect())
}

pub fn display_relative(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}
