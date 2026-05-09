#!/usr/bin/env bash
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-28byj-48"

for f in \
  knowledge/28byj-48-gear-reduction-trades-speed-for-precision-at-a-ratio-that-eliminates-most-dynamic-applications.md \
  knowledge/accelstepper-pin-order-for-28byj-48-is-not-sequential-and-miswiring-produces-vibration-instead-of-rotation.md \
  knowledge/open-loop-steppers-silently-lose-position-on-stall-and-have-no-recovery-mechanism-without-external-feedback.md \
  knowledge/stepper-drive-mode-selection-is-a-three-way-trade-between-torque-smoothness-and-resolution.md \
  knowledge/stepper-holding-current-draws-continuous-power-even-when-stationary-making-de-energize-logic-essential-for-battery-projects.md \
  docs/parts/28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver.md \
  docs/parts/uln2003apg-stepper-driver-board-for-28byj-48-at-5v.md \
  docs/parts/l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
