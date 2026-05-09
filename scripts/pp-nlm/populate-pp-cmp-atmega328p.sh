#!/usr/bin/env bash
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-cmp-atmega328p"

for f in \
  knowledge/hardware-component-atmega328p.md \
  knowledge/hardware-board-arduino-uno-r3.md \
  knowledge/eda-avr-constraints.md \
  knowledge/mcu-avr-boards.md \
  knowledge/arduino-leonardo-atmega32u4-native-usb-enables-hid-keyboard-mouse-emulation-that-arduino-uno-cannot-do-without-hacking.md \
  knowledge/samd51-and-other-arm-arduino-boards-break-atmega-library-compatibility-silently.md \
  docs/parts/arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b.md \
  docs/parts/arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb.md \
  docs/parts/dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb.md \
  docs/parts/osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v.md \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
