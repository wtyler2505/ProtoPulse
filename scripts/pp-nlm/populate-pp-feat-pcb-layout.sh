#!/usr/bin/env bash
# Populate pp-feat-pcb-layout (Tier-2). Curated source set:
#   - 2026-03-05 PCB layout engine plan (the canonical plan template)
#   - 2026-03-06 differential-pair routing plan
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-feat-pcb-layout"

for f in \
  docs/plans/2026-03-05-pcb-layout-engine.md \
  docs/plans/2026-03-06-differential-pair-routing.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
