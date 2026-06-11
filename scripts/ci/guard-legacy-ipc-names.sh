#!/usr/bin/env bash

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

TARGET_FILE="client/src/lib/tauri-api.ts"
if [[ ! -f "$TARGET_FILE" ]]; then
  echo "[guard-legacy-ipc] FAIL: missing $TARGET_FILE" >&2
  exit 1
fi

declare -a PATTERNS=(
  'invoke\("read_file_contents"'
  "invoke\\('read_file_contents'"
  'invoke\("write_file_contents"'
  "invoke\\('write_file_contents'"
  'invoke\("get_app_version"'
  "invoke\\('get_app_version'"
)

for pattern in "${PATTERNS[@]}"; do
  if rg -n "$pattern" "$TARGET_FILE" >/dev/null; then
    echo "[guard-legacy-ipc] FAIL: found legacy raw invoke in $TARGET_FILE matching pattern: $pattern" >&2
    echo "[guard-legacy-ipc] Use generated bindings commands.* instead of legacy invoke names." >&2
    exit 1
  fi
done

echo "[guard-legacy-ipc] PASS: no legacy invoke names in $TARGET_FILE"
