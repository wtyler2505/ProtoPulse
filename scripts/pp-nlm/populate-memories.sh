#!/usr/bin/env bash
# Phase 2 — populate pp-memories notebook (auto-memory mirror).
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-memories"

MEM_DIR="$HOME/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory"
if [ ! -d "$MEM_DIR" ]; then
  echo "WARN: memory dir not found: $MEM_DIR — nothing to populate" >&2
  exit 0
fi

for f in "$MEM_DIR"/*.md; do
  [ -f "$f" ] && add_source_text "$ALIAS" "$f"
done

echo ""
echo "Done populating $ALIAS"
echo "Source count in manifest: $(pp_manifest_count "$ALIAS")"
