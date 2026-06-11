#!/usr/bin/env bash
#
# Regenerate Tauri contract artifacts and emit a deterministic diff report.
#
# Artifacts covered:
#   - client/src/lib/bindings.ts (tauri-specta export)
#   - src-tauri/gen/schemas/*    (tauri build-generated schema outputs)
#
# Usage:
#   bash scripts/ci/regen-tauri-contract-artifacts.sh
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
RUST_TOOLCHAIN="${RUST_TOOLCHAIN:-1.93.0}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_DIR="docs/collab"
REPORT_PATH="$REPORT_DIR/${STAMP}-tauri-contract-artifacts-diff.md"
mkdir -p "$REPORT_DIR"

TRACKED=(
  "client/src/lib/bindings.ts"
  "src-tauri/gen/schemas/acl-manifests.json"
  "src-tauri/gen/schemas/capabilities.json"
  "src-tauri/gen/schemas/desktop-schema.json"
  "src-tauri/gen/schemas/linux-schema.json"
)

echo "[regen-contract] starting at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[regen-contract] rust toolchain: ${RUST_TOOLCHAIN}"
echo "[regen-contract] step 1/3: export bindings"
rustup run "${RUST_TOOLCHAIN}" npm run tauri:bindings:export

echo "[regen-contract] step 2/3: regenerate schemas via bounded tauri build"
rustup run "${RUST_TOOLCHAIN}" npm run tauri:build -- --debug --bundles deb

echo "[regen-contract] step 3/3: write deterministic diff report -> $REPORT_PATH"
{
  echo "# Tauri Contract Artifact Diff Report"
  echo
  echo "- Timestamp (UTC): ${STAMP}"
  echo "- Command: \`bash scripts/ci/regen-tauri-contract-artifacts.sh\`"
  echo
  echo "## Tracked files"
  for p in "${TRACKED[@]}"; do
    echo "- \`$p\`"
  done
  echo
  echo "## Git status (tracked files only)"
  echo '```text'
  for p in "${TRACKED[@]}"; do
    git status --short -- "$p"
  done
  echo '```'
  echo
  echo "## Unified diff (tracked files only)"
  echo '```diff'
  git diff -- "${TRACKED[@]}"
  echo '```'
} > "$REPORT_PATH"

echo "[regen-contract] done"
echo "[regen-contract] report: $REPORT_PATH"
