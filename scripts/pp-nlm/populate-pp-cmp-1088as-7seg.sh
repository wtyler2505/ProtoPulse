#!/usr/bin/env bash
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-1088as-7seg"

for f in \
  knowledge/1088as-pin-numbering-is-non-sequential-across-rows-and-columns-making-orientation-verification-mandatory.md \
  knowledge/common-cathode-and-common-anode-7-segment-displays-are-electrically-incompatible-and-swapping-them-silently-breaks-firmware.md \
  knowledge/direct-driving-a-4-digit-7-segment-display-consumes-12-gpio-pins-and-requires-constant-software-multiplexing.md \
  knowledge/direct-driving-an-8x8-led-matrix-consumes-16-io-pins-and-locks-the-cpu-to-display-refresh.md \
  knowledge/max7219-is-the-universal-led-display-driver-for-both-matrices-and-7-segments.md \
  knowledge/max7219-only-works-with-common-cathode-displays-because-dig-pins-are-current-sinks.md \
  knowledge/hardware-component-7-segment-display-common-cathode.md \
  docs/parts/1088as-8x8-red-led-dot-matrix-common-cathode-3mm.md \
  docs/parts/4-digit-7-segment-display-hs420561k-common-cathode.md \
  docs/parts/5161as-single-digit-7-segment-led-display-red-common-cathode.md \
  docs/parts/max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins.md \
  docs/parts/unidentified-8x8-matrix-board-lw-45-24p.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
