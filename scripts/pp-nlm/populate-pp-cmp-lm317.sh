#!/usr/bin/env bash
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-lm317"

for f in \
  knowledge/hardware-component-lm317-adjustable-positive-regulator.md \
  knowledge/hardware-component-lm337-adjustable-negative-regulator.md \
  knowledge/linear-regulator-heat-dissipation-equals-voltage-drop-times-current-making-high-differential-applications-dangerous.md \
  knowledge/hardware-component-lm7805-5v-linear-regulator.md \
  knowledge/hardware-component-lm7812-12v-linear-regulator.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
