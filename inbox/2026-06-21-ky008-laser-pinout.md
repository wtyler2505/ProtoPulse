---
summary: KY-008 laser diode module — WEB-verified 3-pin emitter pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: arduinomodules + espboards + build-electronic-circuits + electropeak KY-008 (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# KY-008 laser diode module — verification note

Added `core:ky008-laser` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. Output emitter (same family as the
KY-006 buzzer); 650 nm red laser transmitter.

## Part
- **MPN:** KY-008 (650 nm 5 mW red laser diode + current-limit resistor)
- **Reference:** https://arduinomodules.info/ky-008-laser-transmitter-module/
- **Function:** fires a red laser when S is driven HIGH (or PWM).
- **Class:** modeled `class: 'ic'`, refPrefix **D** (diode emitter)

## Pinout — verified signals (3-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | S | on/off (or PWM) drive from MCU | input |
| 2 | VCC | middle pin — 5 V (unlabeled; sometimes NC) | power_in |
| 3 | GND | ground | power_in |

## Silk note
Most KY-008 boards only label **S** and **–**; the middle pin is unmarked. On most
boards it is VCC (+5 V); on some variants the laser runs from S alone, so the middle
pin can be left unconnected. 650 nm, 5 mW, 5 V, <40 mA.

## Verification
- Web sources: arduinomodules KY-008, espboards KY-008, build-electronic-circuits
  KY-008, electropeak KY-008 — agree on S/middle/GND and 650 nm 5 V specs.
- Vault (`qmd_search`): no prior KY-008 note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).
- S modeled as an input to the module (MCU output drives it).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-ky008-laser.md`
(never author `knowledge/` directly).
