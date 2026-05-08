#!/usr/bin/env bash
# Phase 2 — populate pp-codebase notebook.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-codebase"

# Plans (docs/plans + docs/superpowers/plans)
for plan in "$ROOT"/docs/plans/*.md "$ROOT"/docs/superpowers/plans/*.md; do
  [ -f "$plan" ] && add_source_text "$ALIAS" "$plan" "Plan — $(basename "$plan" .md) v1 — $(date -u +%Y-%m-%d)"
done

# Top-level guides
for f in CLAUDE.md docs/DEVELOPER.md docs/AI_AGENT_GUIDE.md docs/USER_GUIDE.md; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

# package.json snapshot as text
TMP_PKG=$(mktemp --suffix=.md)
{
  echo "# ProtoPulse package.json snapshot — $(date -u +%Y-%m-%d)"
  echo
  echo '```json'
  cat "$ROOT/package.json"
  echo '```'
} > "$TMP_PKG"
add_source_text "$ALIAS" "$TMP_PKG" "package.json snapshot v1 — $(date -u +%Y-%m-%d)"
rm -f "$TMP_PKG"

# Codebase summary via scc (if available)
if command -v scc >/dev/null 2>&1; then
  TMP_SCC=$(mktemp --suffix=.md)
  {
    echo "# ProtoPulse codebase summary (scc) — $(date -u +%Y-%m-%d)"
    echo
    echo '```'
    scc --no-cocomo "$ROOT/client" "$ROOT/server" 2>/dev/null
    echo '```'
  } > "$TMP_SCC"
  add_source_text "$ALIAS" "$TMP_SCC" "Codebase summary (scc) v1 — $(date -u +%Y-%m-%d)"
  rm -f "$TMP_SCC"
fi

echo ""
echo "Done populating $ALIAS"
echo "Source count in manifest: $(pp_manifest_count "$ALIAS")"
