#!/usr/bin/env bash
#
# Install Boson from GitHub Releases.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/yogthesharma/boson-dev/main/install.sh | bash
#
# Override behaviour via environment variables:
#   BOSON_VERSION       — release tag to install (default: latest)
#   BOSON_INSTALL_DIR   — destination directory (default: $HOME/.local/bin)
#   BOSON_INSTALL_REPO  — `<owner>/<name>` to download from
#                         (default: yogthesharma/boson-dev)

set -euo pipefail

REPO="${BOSON_INSTALL_REPO:-yogthesharma/boson-dev}"
INSTALL_DIR="${BOSON_INSTALL_DIR:-${HOME}/.local/bin}"
VERSION="${BOSON_VERSION:-latest}"

msg()  { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

curl_retry() {
  curl \
    --fail \
    --location \
    --retry 6 \
    --retry-delay 2 \
    --retry-max-time 120 \
    --retry-all-errors \
    "$@"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

detect_target() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin)
      case "$arch" in
        x86_64)         echo "x86_64-apple-darwin" ;;
        arm64|aarch64)  echo "aarch64-apple-darwin" ;;
        *) die "unsupported macOS architecture: $arch" ;;
      esac ;;
    Linux)
      case "$arch" in
        x86_64|amd64)   echo "x86_64-unknown-linux-gnu" ;;
        aarch64|arm64)  echo "aarch64-unknown-linux-gnu" ;;
        *) die "unsupported Linux architecture: $arch" ;;
      esac ;;
    MINGW*|MSYS*|CYGWIN*)
      die "Windows is not supported by this script — download the .zip from https://github.com/${REPO}/releases" ;;
    *)
      die "unsupported OS: $os" ;;
  esac
}

resolve_version() {
  if [ "$VERSION" != "latest" ]; then
    return
  fi
  local api="https://api.github.com/repos/${REPO}/releases/latest"
  local tag
  tag="$(
    curl_retry -sS "$api" \
      | grep -E '"tag_name"[[:space:]]*:' \
      | head -n 1 \
      | sed -E 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' \
      || true
  )"
  [ -n "${tag:-}" ] || die "could not resolve latest release tag from ${api}"
  VERSION="$tag"
}

sha256_verify() {
  local file="$1" expected="$2"
  local got=""
  if command -v shasum >/dev/null 2>&1; then
    got="$(shasum -a 256 "$file" | awk '{print $1}')"
  elif command -v sha256sum >/dev/null 2>&1; then
    got="$(sha256sum "$file" | awk '{print $1}')"
  else
    warn "no shasum/sha256sum available — skipping checksum verification"
    return 0
  fi
  if [ "$got" != "$expected" ]; then
    die "checksum mismatch for ${file##*/} (expected $expected, got $got)"
  fi
}

main() {
  require_cmd curl
  require_cmd tar

  local target asset url tmp tarball
  target="$(detect_target)"
  resolve_version

  asset="boson-${target}.tar.gz"
  url="https://github.com/${REPO}/releases/download/${VERSION}/${asset}"

  msg "Installing boson ${VERSION} for ${target}"
  msg "  source: ${url}"
  msg "  dest  : ${INSTALL_DIR}/boson"
  msg ""

  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp:-}"' EXIT INT TERM

  tarball="${tmp}/${asset}"
  curl_retry --progress-bar --output "$tarball" "$url" \
    || die "failed to download $url"

  local expected_sha=""
  if curl_retry -sS "${url}.sha256" -o "${tmp}/${asset}.sha256" 2>/dev/null; then
    expected_sha="$(awk '{print $1}' "${tmp}/${asset}.sha256" | head -n 1 || true)"
  fi
  if [ -n "$expected_sha" ]; then
    sha256_verify "$tarball" "$expected_sha"
    msg "checksum ok."
  else
    warn "no .sha256 published for ${asset} — skipping verification"
  fi

  tar -xzf "$tarball" -C "$tmp"

  local binary="${tmp}/boson-${target}/boson"
  [ -f "$binary" ] || binary="${tmp}/boson"
  [ -f "$binary" ] || die "could not find 'boson' inside ${asset}"

  mkdir -p "$INSTALL_DIR"
  mv "$binary" "${INSTALL_DIR}/boson"
  chmod 755 "${INSTALL_DIR}/boson"

  msg ""
  msg "Installed: ${INSTALL_DIR}/boson"

  case ":${PATH:-}:" in
    *":${INSTALL_DIR}:"*)
      msg "Run \`boson --version\` to verify."
      ;;
    *)
      msg ""
      msg "${INSTALL_DIR} is not on your PATH yet. Add it with:"
      msg ""
      msg "  echo 'export PATH=\"${INSTALL_DIR}:\$PATH\"' >> ~/.bashrc"
      msg "  echo 'export PATH=\"${INSTALL_DIR}:\$PATH\"' >> ~/.zshrc"
      msg ""
      msg "Then restart your shell and run \`boson --version\`."
      ;;
  esac
}

main "$@"
