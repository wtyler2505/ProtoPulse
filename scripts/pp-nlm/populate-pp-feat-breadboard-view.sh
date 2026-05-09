#!/usr/bin/env bash
# Populate pp-feat-breadboard-view (Tier-2). Curated source set:
#   - breadboard-lab skill body (the operator skill itself)
#   - 3 breadboard architecture plans (2026-04-10 trilogy)
#   - 2026-04-17 deep audit (399 findings)
#   - client/src/lib/breadboard-ai-prompts.ts (the AI prompt templates feeding the rendering decisions)
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-feat-breadboard-view"

[ -f "$ROOT/.claude/skills/breadboard-lab/SKILL.md" ] && add_source_text "$ALIAS" "$ROOT/.claude/skills/breadboard-lab/SKILL.md"

for plan in \
  docs/superpowers/plans/2026-04-10-breadboard-bench-surface-and-visual-expansion.md \
  docs/superpowers/plans/2026-04-10-breadboard-intelligence-and-inventory.md \
  docs/superpowers/plans/2026-04-10-breadboard-interaction-and-sync.md \
  docs/audits/2026-04-17-breadboard-lab-deep-audit.md \
  client/src/lib/breadboard-ai-prompts.ts \
; do
  [ -f "$ROOT/$plan" ] && add_source_text "$ALIAS" "$ROOT/$plan"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
