---
summary: KY-004 button module — WEB-verified 3-pin pull-down pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: arduinomodules + espboards + joy-it SensorKit + Cirkit Designer KY-004 (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# KY-004 button module — verification note

Added `core:ky004-button` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. Distinct from the bare 2-pin
`core:pushbutton` (this is a 3-pin module with an onboard resistor that outputs a clean
logic level).

## Part
- **MPN:** KY-004 — tactile push button + 10 kΩ resistor
- **Reference:** https://arduinomodules.info/ky-004-key-switch-module/
- **Function:** momentary key switch → logic-level output.
- **Class:** modeled `class: 'ic'`, refPrefix **SW**

## Pinout — verified signals (3-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | S | logic out: LOW at rest, HIGH pressed | output |
| 2 | VCC | middle pin — 3.3–5 V | power_in |
| 3 | GND | ground | power_in |

## Behavior note
The standard (original Keyes) KY-004 is a **pull-down** module (onboard 10 kΩ): S sits
LOW at rest and goes HIGH when pressed (**active-high**), so S is modeled as an output
from the module (it drives the level the MCU reads with `pinMode(pin, INPUT)`). A
pull-up clone variant exists (inverted). 3.3–5 V.

## Verification
- Web sources: arduinomodules KY-004, espboards KY-004, joy-it SensorKit KY-004,
  Cirkit Designer KY-004 — agree on S/middle-VCC/GND and the pull-down active-high
  default.
- Vault (`qmd_search`): no prior KY-004 note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-ky004-button.md`
(never author `knowledge/` directly).
