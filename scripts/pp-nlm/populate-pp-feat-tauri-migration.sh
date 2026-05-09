#!/usr/bin/env bash
# Populate pp-feat-tauri-migration (Tier-2). Roadmap notebook — sparse sources.
#   - Tauri migration tracker memory file
#   - Any existing Tauri references in plans/docs
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-feat-tauri-migration"

# Tauri migration memory (cross-project memory pointer)
MEM="$HOME/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/project_tauri_migration.md"
[ -f "$MEM" ] && add_source_text "$ALIAS" "$MEM"

# Existing Tauri-aware plans/docs
for f in \
  docs/superpowers/plans/2026-04-10-gemini-cli-tuneup.md \
  docs/superpowers/plans/2026-04-18-e2e-walkthrough/18-innovation-roadmap.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS (roadmap notebook — grows as migration begins)"
echo "Source count: $(pp_manifest_count "$ALIAS")"
