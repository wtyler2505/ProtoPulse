#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# Local/CI-safe defaults for environments where home caches are read-only or
# network is flaky. Callers can still override any value before invoking.
export npm_config_cache="${npm_config_cache:-/tmp/npm-cache-protopulse}"
export CARGO_HOME="${CARGO_HOME:-/tmp/cargo-home-protopulse}"
export CARGO_HTTP_MULTIPLEXING="${CARGO_HTTP_MULTIPLEXING:-false}"
export CARGO_NET_RETRY="${CARGO_NET_RETRY:-10}"

exec bash scripts/tauri-preflight.sh "$@"
