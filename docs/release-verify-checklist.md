# Release Verify Checklist

## Before you publish

1. Bump `version` in `Cargo.toml` and merge to `main`.
2. Create and **push the tag to `origin`** (preflight requires the tag on the remote):
   `git tag -a v0.1.6 -m "Release v0.1.6" && git push origin v0.1.6`
3. Either wait for the workflow triggered by the tag push, or run **Actions → release → Run workflow** with the same tag (only after step 2).

Run the checklist below after the release job finishes (for example for `v0.1.6`).

- [ ] Release page has all expected assets:
  - `boson-x86_64-apple-darwin.tar.gz` (+ `.sha256`, if build succeeded)
  - `boson-aarch64-apple-darwin.tar.gz` (+ `.sha256`, optional/non-blocking build)
  - `boson-x86_64-unknown-linux-gnu.tar.gz` + `.sha256`
  - `boson-aarch64-unknown-linux-gnu.tar.gz` + `.sha256`
  - `boson-x86_64-pc-windows-msvc.zip` + `.sha256`
- [ ] SHA256 files validate their matching archives.
- [ ] `install.sh` can install from the new tag:
  - `BOSON_VERSION=<tag> bash ./install.sh`
  - Installed binary returns expected output for `boson --version`.

The release workflow now includes an automated `Verify release artifacts` job
that checks these items for Linux/Windows assets and runs an `install.sh` smoke
test against the published tag.
