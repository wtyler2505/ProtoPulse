#!/usr/bin/env bash
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-mosfet-nmos"

for f in \
  knowledge/hardware-component-2n7000-n-channel-mosfet.md \
  knowledge/hardware-component-irf540n-n-channel-power-mosfet.md \
  knowledge/hardware-component-irlz44n-logic-level-n-channel-mosfet.md \
  knowledge/bjt-switching-tops-out-at-600ma-in-to-92-and-the-transition-to-mosfet-is-a-hard-architecture-boundary.md \
  knowledge/floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot.md \
  knowledge/logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit.md \
  knowledge/bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals.md \
  knowledge/bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets.md \
  knowledge/dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
