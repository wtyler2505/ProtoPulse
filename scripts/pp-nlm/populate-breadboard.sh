#!/usr/bin/env bash
# Phase 2 — populate pp-breadboard (Breadboard Lab + maker workbench).
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-breadboard"

# breadboard-lab skill body
SKILL="$ROOT/.claude/skills/breadboard-lab/SKILL.md"
[ -f "$SKILL" ] && add_source_text "$ALIAS" "$SKILL"

# Breadboard-related plans + audit
for f in \
  docs/superpowers/plans/2026-04-10-breadboard-bench-surface-and-visual-expansion.md \
  docs/superpowers/plans/2026-04-10-breadboard-intelligence-and-inventory.md \
  docs/superpowers/plans/2026-04-10-breadboard-interaction-and-sync.md \
  docs/audits/2026-04-17-breadboard-lab-deep-audit.md \
  client/src/lib/breadboard-ai-prompts.ts \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo ""
echo "Done populating $ALIAS"
echo "Source count in manifest: $(pp_manifest_count "$ALIAS")"
