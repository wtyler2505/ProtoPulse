---
summary: KY-016 RGB LED module — WEB-verified 4-pin common-cathode pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: arduinomodules + espboards + joy-it SensorKit + Cirkit Designer KY-016 (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# KY-016 RGB LED module — verification note

Added `core:ky016-rgb-led` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. Output device; distinct from the
existing single-color `core:led` seed part.

## Part
- **MPN:** KY-016 — 5 mm common-cathode RGB LED + 3×150 Ω resistors
- **Reference:** https://arduinomodules.info/ky-016-rgb-full-color-led-module/
- **Function:** full-color LED — PWM each channel for mixed colors.
- **Class:** modeled `class: 'ic'`, refPrefix **D** (LED)

## Pinout — verified signals (4-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | R | red anode (PWM via 150 Ω) | input |
| 2 | G | green anode | input |
| 3 | B | blue anode | input |
| 4 | GND | common cathode / ground | power_in |

## Modeling note
**Common-cathode**: all three LEDs share the GND pin; R/G/B are the anodes, each with
an onboard 150 Ω series resistor, driven by PWM lines (modeled as inputs to the
module). 20 mA/channel; Vf ≈1.8 V red, ≈2.8 V green/blue. (A common-anode KY-009 SMD
variant exists separately.)

## Verification
- Web sources: arduinomodules KY-016, espboards KY-016, joy-it SensorKit KY-016,
  Cirkit Designer RGB LED module — agree on R/G/B/GND and common-cathode + 150 Ω.
- Vault (`qmd_search`): no prior KY-016 note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-ky016-rgb-led.md`
(never author `knowledge/` directly).
