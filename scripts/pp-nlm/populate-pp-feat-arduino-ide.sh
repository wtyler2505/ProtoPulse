#!/usr/bin/env bash
# Populate pp-feat-arduino-ide (Tier-2). Curated source set:
#   - 2026-02-28-arduino-ide-integration plan (the integration architecture)
#   - 2026-04-18 e2e walkthrough Arduino serial-code section
#   - Vault claims about Arduino board variants + AccelStepper pin order
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-feat-arduino-ide"

for f in \
  docs/plans/2026-02-28-arduino-ide-integration-plan.md \
  docs/superpowers/plans/2026-04-18-e2e-walkthrough/12-arduino-serial-code.md \
  docs/superpowers/plans/2026-04-18-e2e-walkthrough/00-master-index.md \
  knowledge/arduino-leonardo-atmega32u4-native-usb-enables-hid-keyboard-mouse-emulation-that-arduino-uno-cannot-do-without-hacking.md \
  knowledge/accelstepper-pin-order-for-28byj-48-is-not-sequential-and-miswiring-produces-vibration-instead-of-rotation.md \
  knowledge/samd51-and-other-arm-arduino-boards-break-atmega-library-compatibility-silently.md \
  knowledge/mcu-avr-boards.md \
  knowledge/eda-avr-constraints.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
