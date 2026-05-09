#!/usr/bin/env bash
# Populate pp-feat-parts-catalog (Tier-2). Curated source set:
#   - The 4 parts plans (consolidation, extraction, vault health, breadboard intelligence)
#   - The catalog code surface: alternate-parts.ts, breadboard-part-inspector.ts, inventory-health.ts, lcsc-part-mapper.ts
#   - Sample of docs/parts/ entries (NOT all 16K — would oversize the notebook; representative subset)
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-feat-parts-catalog"

# Plans
for plan in \
  docs/superpowers/plans/2026-04-10-breadboard-intelligence-and-inventory.md \
  docs/superpowers/plans/2026-04-12-parts-knowledge-extraction.md \
  docs/plans/2026-04-10-parts-catalog-consolidation.md \
  docs/plans/2026-04-11-knowledge-vault-health-restoration.md \
; do
  [ -f "$ROOT/$plan" ] && add_source_text "$ALIAS" "$ROOT/$plan"
done

# Code surface
for f in \
  client/src/lib/alternate-parts.ts \
  client/src/lib/breadboard-part-inspector.ts \
  client/src/lib/inventory-health.ts \
  client/src/lib/lcsc-part-mapper.ts \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

# Representative parts catalog samples (NOT full 16K — that's pp-hardware vault territory)
# Pick parts Tyler uses heavily that have structured catalog entries
for part in \
  docs/parts/1088as-8x8-red-led-dot-matrix-common-cathode-3mm.md \
  docs/parts/28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver.md \
  docs/parts/uln2003apg-stepper-driver-board-for-28byj-48-at-5v.md \
  docs/parts/74hc595-8-bit-shift-register-serial-to-parallel-dip16.md \
  docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md \
  docs/parts/arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b.md \
  docs/parts/arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb.md \
  docs/parts/100nf-ceramic-capacitor-104-50v-decoupling-bypass.md \
  docs/parts/4-digit-7-segment-display-hs420561k-common-cathode.md \
  docs/parts/l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a.md \
; do
  [ -f "$ROOT/$part" ] && add_source_text "$ALIAS" "$ROOT/$part"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
