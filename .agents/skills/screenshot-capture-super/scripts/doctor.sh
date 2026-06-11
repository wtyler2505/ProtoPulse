#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
BASE_URL="${BASE_URL:-http://localhost:5000}"

echo "[doctor] root=$ROOT"
echo "[doctor] base_url=$BASE_URL"

fail=0

check_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "[ok] command found: $cmd"
  else
    echo "[fail] missing command: $cmd"
    fail=1
  fi
}

check_cmd node
check_cmd npm
check_cmd npx

if [[ -f "$ROOT/package.json" ]]; then
  echo "[ok] package.json found"
else
  echo "[fail] package.json missing in $ROOT"
  fail=1
fi

if [[ -f "$ROOT/playwright.config.ts" ]]; then
  echo "[ok] playwright.config.ts found"
else
  echo "[warn] playwright.config.ts missing (capture may still run if script is self-contained)"
fi

if curl -fsS "$BASE_URL" >/dev/null 2>&1; then
  echo "[ok] dev server reachable"
else
  echo "[warn] dev server not reachable at $BASE_URL (start app before real capture)"
fi

if [[ $fail -ne 0 ]]; then
  echo "[doctor] failed"
  exit 1
fi

echo "[doctor] passed"

