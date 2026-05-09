#!/usr/bin/env bash
# Populate pp-feat-mna-solver (Tier-2). Curated source set:
#   - All client/src/lib/simulation/*.ts (the solver + parser + multimeter + complexity-checker)
#   - Tests under client/src/lib/simulation/__tests__/
#   - server/ai-tools/simulation.ts (server-side bridge)
#   - 24_BE-10 SPICE backend audit
#   - Plans referencing MNA / circuit simulation
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-feat-mna-solver"

# Solver code surface
for f in $ROOT/client/src/lib/simulation/*.ts; do
  [ -f "$f" ] && add_source_text "$ALIAS" "$f"
done
# Tests
for f in $ROOT/client/src/lib/simulation/__tests__/*.ts; do
  [ -f "$f" ] && add_source_text "$ALIAS" "$f"
done

[ -f "$ROOT/server/ai-tools/simulation.ts" ] && add_source_text "$ALIAS" "$ROOT/server/ai-tools/simulation.ts"

# Audit + plans
for plan in \
  docs/audits_and_evaluations_by_codex/24_BE-10_simulation_spice_backend_audit.md \
  docs/plans/2026-03-06-wave-48-plan.md \
  docs/plans/2026-03-07-circuit-design-as-code.md \
  docs/plans/2026-03-07-wave-51-final-moonshots.md \
; do
  [ -f "$ROOT/$plan" ] && add_source_text "$ALIAS" "$ROOT/$plan"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
