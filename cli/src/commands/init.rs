use std::path::Path;

use anyhow::{bail, Context, Result};

const TEMPLATE: &str = r#"workspace: my-team

environments:
  - name: local
    baseUrl: http://localhost:8080
    vars: {}

requests:
  - id: example.hello
    name: Hello
    method: GET
    url: "{{baseUrl}}/hello"
    headers:
      Accept: application/json
    body:
      type: none
"#;

pub fn run(path: &Path) -> Result<()> {
    if path.exists() {
        bail!("{} already exists; refusing to overwrite", path.display());
    }
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("creating {}", parent.display()))?;
        }
    }
    std::fs::write(path, TEMPLATE)
        .with_context(|| format!("writing {}", path.display()))?;
    println!("wrote {}", path.display());
    println!("next: `boson push --file {}` to sync.", path.display());
    Ok(())
}
