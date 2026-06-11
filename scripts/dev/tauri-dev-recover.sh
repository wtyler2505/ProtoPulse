#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "${ROOT_DIR}"

echo "[tauri-recover] Resetting Vite optimize cache..."
bash scripts/dev/reset-vite-cache.sh

echo "[tauri-recover] Starting integrated API + Vite dev server on :5000..."
npm run dev >/tmp/protopulse-server-dev.log 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "[tauri-recover] Waiting for API readiness on http://localhost:5000/api/health ..."
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:5000/api/health" >/dev/null 2>&1; then
    echo "[tauri-recover] API + Vite dev server is ready."
    break
  fi
  sleep 1
done

if ! curl -sf "http://localhost:5000/api/health" >/dev/null 2>&1; then
  echo "[tauri-recover] API + Vite dev server did not come up in time. See /tmp/protopulse-server-dev.log"
  exit 1
fi

echo "[tauri-recover] Launching Tauri desktop app..."
npm run tauri:dev
