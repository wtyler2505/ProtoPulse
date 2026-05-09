#!/usr/bin/env bash
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-ams1117"

for f in \
  knowledge/hardware-component-ams1117-3-3-3-3v-ldo-regulator.md \
  knowledge/esp32-ams1117-regulator-limits-total-board-current-to-800ma.md \
  knowledge/10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds.md \
  knowledge/linear-regulator-heat-dissipation-equals-voltage-drop-times-current-making-high-differential-applications-dangerous.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
