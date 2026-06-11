#!/usr/bin/env bash
#
# Packaged-build smoke runner (Phase 5 closeout gate).
#
# Runs `tauri build --debug` and asserts an executable bundle landed under
# `src-tauri/target/debug/bundle`. Per the release-trust-model ADR Decision 4,
# the production matrix builds deb + AppImage on Linux; this smoke gate uses
# the same `bundle.targets` from tauri.conf.json so we exercise the same code
# paths CI does.
#
# Usage:
#     bash scripts/ci/tauri-packaged-smoke.sh
#
# Exit codes:
#     0  smoke passed (artifacts found)
#     1  build failed
#     2  artifacts missing (build claimed success but bundle dir is empty)

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Honor /tmp cache overrides used by scripts/tauri-preflight.sh so this script
# runs cleanly when home caches are read-only (e.g., sandboxed CI runners).
export npm_config_cache="${npm_config_cache:-/tmp/npm-cache-protopulse}"
export CARGO_HOME="${CARGO_HOME:-/tmp/cargo-home-protopulse}"

echo "[tauri-packaged-smoke] starting"
echo "[tauri-packaged-smoke] CARGO_HOME=$CARGO_HOME npm_config_cache=$npm_config_cache"

# Frontend prereq: dist/public/* + dist/index.cjs must exist before tauri build
# packages assets. `npm run build` produces both.
if [[ ! -f dist/public/index.html ]]; then
    echo "[tauri-packaged-smoke] dist/public/index.html missing — running npm run build"
    npm run build
fi

echo "[tauri-packaged-smoke] running tauri build --debug --bundles deb"
npm run tauri:build -- --debug --bundles deb

ARTIFACT_DIR="src-tauri/target/debug/bundle"
DEB_DIR="$ARTIFACT_DIR/deb"
if [[ ! -d "$ARTIFACT_DIR" ]]; then
    echo "[tauri-packaged-smoke] FAIL: $ARTIFACT_DIR not created" >&2
    exit 2
fi

echo "[tauri-packaged-smoke] bundle artifacts:"
find "$ARTIFACT_DIR" -maxdepth 3 -type f \
    \( -name "*.deb" -o -name "*.AppImage" -o -name "*.msi" -o -name "*.exe" -o -name "*.dmg" -o -name "*.app" -o -name "protopulse" \) \
    -printf '  %p (%s bytes)\n' 2>/dev/null || true

# At least one bundle artifact should exist.
COUNT=$(find "$ARTIFACT_DIR" -maxdepth 3 -type f \
    \( -name "*.deb" -o -name "*.AppImage" -o -name "*.msi" -o -name "*.exe" -o -name "*.dmg" \) \
    2>/dev/null | wc -l)

if [[ "$COUNT" -eq 0 ]]; then
    echo "[tauri-packaged-smoke] FAIL: no .deb/.AppImage/.msi/.exe/.dmg artifacts found in $ARTIFACT_DIR" >&2
    exit 2
fi

echo "[tauri-packaged-smoke] PASS: $COUNT artifact(s) produced"

# Linux gate: require the exact .deb output path so CI catches naming/location
# regressions instead of only proving "some artifact exists".
if [[ ! -d "$DEB_DIR" ]]; then
    echo "[tauri-packaged-smoke] FAIL: expected deb directory missing: $DEB_DIR" >&2
    exit 2
fi

APP_VERSION=$(sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*$/\1/p' src-tauri/tauri.conf.json | head -n1)
if [[ -z "$APP_VERSION" ]]; then
    echo "[tauri-packaged-smoke] FAIL: could not parse version from src-tauri/tauri.conf.json" >&2
    exit 2
fi

case "$(uname -m)" in
    x86_64) DEB_ARCH="amd64" ;;
    aarch64|arm64) DEB_ARCH="arm64" ;;
    *) DEB_ARCH="$(uname -m)" ;;
esac

EXPECTED_DEB_PATH="$DEB_DIR/protopulse_${APP_VERSION}_${DEB_ARCH}.deb"
if [[ ! -f "$EXPECTED_DEB_PATH" ]]; then
    echo "[tauri-packaged-smoke] FAIL: expected .deb not found at exact path:" >&2
    echo "  $EXPECTED_DEB_PATH" >&2
    echo "[tauri-packaged-smoke] observed .deb files under $DEB_DIR:" >&2
    find "$DEB_DIR" -maxdepth 2 -type f -name "*.deb" -printf '  %p\n' 2>/dev/null >&2 || true
    exit 2
fi
echo "[tauri-packaged-smoke] PASS: expected .deb path exists: $EXPECTED_DEB_PATH"

# ── Phase 6.2: debug artifact policy ────────────────────────────────────────
# Source maps are generated as `hidden` per vite.config.ts — they exist on
# disk but no JS bundle should reference them, and they MUST NOT ship inside
# the Tauri bundle's resource dir. Surface any leaks.
echo
echo "[tauri-packaged-smoke] checking for stray .map files in bundle (debug artifact policy)"
MAP_LEAK=$(find "$ARTIFACT_DIR" -type f -name "*.map" 2>/dev/null | head -10)
if [[ -n "$MAP_LEAK" ]]; then
    echo "[tauri-packaged-smoke] FAIL: .map files leaked into the public bundle (Phase 6.2 violation):" >&2
    echo "$MAP_LEAK" >&2
    echo "Fix vite.config.ts sourcemap policy or the build script before shipping." >&2
    exit 2
fi
echo "[tauri-packaged-smoke] OK: no .map files in the bundle"
