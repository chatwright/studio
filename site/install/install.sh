#!/bin/sh
# Chatwright CLI installer — the canonical macOS/Linux install path:
#
#   curl -fsSL https://chatwright.dev/install.sh | sh
#
# Downloads the requested (default: latest) GoReleaser release artifact from
# github.com/chatwright/cli, verifies its SHA-256 against the release's
# checksums file, and installs the `chatwright` binary.
#
# Environment overrides:
#   CHATWRIGHT_VERSION  release tag to install (e.g. v0.1.0); default: latest
#   BINDIR              install directory; default: /usr/local/bin
#
# Alternatives: `brew install --cask chatwright/tap/chatwright` (macOS) or
# `go install chatwright.dev/cli/cmd/chatwright@latest`.

set -eu

REPO="chatwright/cli"
BINDIR="${BINDIR:-/usr/local/bin}"

say() { printf '%s\n' "$*"; }
fail() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"

os=$(uname -s)
case "$os" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "unsupported OS: $os (Windows: irm https://chatwright.dev/install.ps1 | iex; otherwise: go install chatwright.dev/cli/cmd/chatwright@latest)" ;;
esac

arch=$(uname -m)
case "$arch" in
  x86_64 | amd64) arch=amd64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) fail "unsupported architecture: $arch (try: go install chatwright.dev/cli/cmd/chatwright@latest)" ;;
esac

version="${CHATWRIGHT_VERSION:-}"
if [ -z "$version" ]; then
  # tag_name is the first (and only) such key in the latest-release document;
  # sed keeps this dependency-free (no jq on a fresh machine).
  version=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" |
    sed -n 's/^ *"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)
  [ -n "$version" ] || fail "could not determine the latest release of ${REPO}"
fi
bare_version=${version#v}

archive="chatwright_${bare_version}_${os}_${arch}.tar.gz"
checksums="chatwright_${bare_version}_checksums.txt"
base="https://github.com/${REPO}/releases/download/${version}"

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT INT TERM

say "Downloading chatwright ${version} (${os}/${arch})..."
curl -fsSL -o "${workdir}/${archive}" "${base}/${archive}" ||
  fail "download failed: ${base}/${archive}"
curl -fsSL -o "${workdir}/${checksums}" "${base}/${checksums}" ||
  fail "download failed: ${base}/${checksums}"

expected=$(sed -n "s/^\([0-9a-f]\{64\}\)  ${archive}\$/\1/p" "${workdir}/${checksums}")
[ -n "$expected" ] || fail "no checksum for ${archive} in ${checksums}"
if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "${workdir}/${archive}" | cut -d' ' -f1)
else
  actual=$(shasum -a 256 "${workdir}/${archive}" | cut -d' ' -f1)
fi
[ "$expected" = "$actual" ] || fail "checksum mismatch for ${archive}: expected ${expected}, got ${actual}"

tar -xzf "${workdir}/${archive}" -C "$workdir" chatwright

if [ -w "$BINDIR" ]; then
  install -m 0755 "${workdir}/chatwright" "${BINDIR}/chatwright"
else
  say "Installing to ${BINDIR} (requires sudo; set BINDIR for a user-writable location)..."
  command -v sudo >/dev/null 2>&1 || fail "${BINDIR} is not writable and sudo is unavailable — re-run with BINDIR=\$HOME/.local/bin"
  sudo install -m 0755 "${workdir}/chatwright" "${BINDIR}/chatwright"
fi

say "Installed:"
"${BINDIR}/chatwright" version
case ":${PATH}:" in
  *":${BINDIR}:"*) ;;
  *) say "Note: ${BINDIR} is not on your PATH." ;;
esac
