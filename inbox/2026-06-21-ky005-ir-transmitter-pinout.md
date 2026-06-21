---
summary: KY-005 IR transmitter module (940nm IR LED) — WEB-verified 3-pin pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: arduinomodules + espboards + thegeekpub + joy-it KY-005 (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# KY-005 IR transmitter module — verification note

Added `core:ky005-ir-transmitter` to `@protopulse/parts`. Pinout **web-verified** —
NOT taken from Tyler's shared `docs/parts-components-ect.md`. The transmit half of the
IR pair (KY-022 receiver is the companion).

## Part
- **MPN:** KY-005 — single 940 nm IR LED
- **Reference:** https://arduinomodules.info/ky-005-infrared-transmitter-sensor-module/
- **Function:** emits 38 kHz-modulated IR (remote-control style) when driven on S.
- **Class:** modeled `class: 'ic'`, refPrefix **D** (LED emitter)

## Pinout — verified signals (3-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | S | 38 kHz-modulated drive from MCU (via series R) | input |
| 2 | VCC | middle pin — NC on KY-005 (no internal connection) | power_in |
| 3 | GND | ground | power_in |

## Drive note
The MCU modulates S with a 38 kHz carrier (Arduino IRremote) through a series resistor
(≈120 Ω @ 3.3 V, ≈220 Ω @ 5 V). On KY-005 the **middle VCC pin is NC** — practically
wire S → GPIO and – → GND. 940 nm wavelength matches the KY-022 / VS1838B receiver.

## Verification
- Web sources: arduinomodules KY-005, espboards KY-005, thegeekpub KY-005, joy-it
  KY-005 PDF — agree on S/middle/GND, 940 nm, middle-pin NC.
- Vault (`qmd_search`): no prior KY-005 note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).
- S modeled as an input to the module (MCU output drives it).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-ky005-ir-transmitter.md`
(never author `knowledge/` directly).
