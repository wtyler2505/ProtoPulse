#!/usr/bin/env bash
# Populate pp-cmp-esp32 (Tier-3). All vault claims + datasheet docs about ESP32.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-esp32"

# All knowledge/esp32-*.md atomic claims
for f in $ROOT/knowledge/esp32-*.md; do
  [ -f "$f" ] && add_source_text "$ALIAS" "$f"
done

# Cross-claims that mention ESP32
for f in \
  knowledge/10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds.md \
  knowledge/74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

# Datasheet doc + wiring guides
for f in \
  docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md \
  docs/parts/wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter.md \
  docs/parts/wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover.md \
  docs/parts/wiring-zs-x11h-to-esp32-with-level-shifter.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
