---
summary: KY-023 dual-axis analog joystick — web-verified 5-pin layout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: arduinomodules.info KY-023 + espboards.dev + watelectronics (web-verified)
verified: 2026-06-22
---

# KY-023 dual-axis analog joystick — verification note

Added `core:ky023-joystick` to `@protopulse/parts`. Classic PS2-style thumbstick module
(Tyler owns it — "Analog Joystick Module" in the component log, 5-pin GND/+5V/VRx/VRy/SW).
Pinout **web-verified**.

## Part
- **MPN:** KY-023 (Keyes / generic)
- **Class:** `ic`, refPrefix **U** (module). 5 pins. Footprint deferred.

## Pinout — 5-pin header
Silk order `GND, +5V, VRx, VRy, SW`.
- **VRx / VRy** = X / Y analog wiper outputs from two perpendicular 10kΩ pots (0–VCC).
- **SW** = momentary push-button (press the stick down); closes to GND, needs an MCU
  pull-up (reads LOW pressed).
- **GND / +5V** = supply (3.3–5 V).

## ERC modeling
- **VRx, VRy, SW → output** — signals the MCU reads (consistent with the seed convention).
- **GND, +5V → power_in.**

## Verification
- Web sources: arduinomodules.info KY-023, espboards.dev/sensors/ky-023, watelectronics —
  agree on GND/+5V/VRx/VRy/SW, the two 10k pots, and the push-button.
- Component log agrees exactly; web is the authority per the standing rule.
- Vault (`qmd_search`): no prior KY-023 note.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-ky023-joystick.md`
(never author `knowledge/` directly).
