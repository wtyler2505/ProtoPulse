#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VITE_CACHE_DIRS=(
  "${ROOT_DIR}/node_modules/.vite"
  "${ROOT_DIR}/node_modules/.cache/vite"
  "${ROOT_DIR}/client/node_modules/.vite"
)

for cache_dir in "${VITE_CACHE_DIRS[@]}"; do
  if [[ -d "${cache_dir}" ]]; then
    rm -rf "${cache_dir}"
    echo "[dev-recovery] Cleared Vite cache: ${cache_dir}"
  fi
done

if pgrep -af "vite( |$)" >/dev/null 2>&1; then
  echo "[dev-recovery] Warning: detected active Vite process(es)."
  pgrep -af "vite( |$)" || true
  echo "[dev-recovery] Stop duplicate Vite dev servers before restarting."
fi

echo "[dev-recovery] Rebuilding dependency optimizer cache (vite optimize --force)..."
(
  cd "${ROOT_DIR}"
  npx vite optimize --force >/dev/null 2>&1 || true
)
echo "[dev-recovery] Optimizer rebuild step completed."
