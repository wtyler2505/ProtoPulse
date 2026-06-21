---
summary: TM1637 4-digit 7-segment display module — WEB-verified 4-pin 2-wire pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: lastminuteengineers + makerguides + circuitdigest + Cirkit Designer TM1637 + Titan Micro TM1637 IC (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# TM1637 4-digit display module — verification note

Added `core:tm1637-display` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. Display-driver part (7-segment).

## Part
- **MPN:** TM1637 (Titan Micro LED driver + key-scan controller)
- **Reference:** https://lastminuteengineers.com/tm1637-arduino-tutorial/
- **Function:** drives a 4-digit 7-segment LED display over a 2-wire bus.
- **Class:** modeled `class: 'ic'`, refPrefix `U`

## Pinout — verified signals (4-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | CLK | 2-wire clock from MCU | input |
| 2 | DIO | 2-wire data I/O (+ key-scan readback) | bidi |
| 3 | VCC | 3.3–5 V | power_in |
| 4 | GND | ground | power_in |

## Interface note
The TM1637 uses a 2-wire protocol that *looks* I²C-like (start/stop + ack) but is **not
standard I²C** (no device address). DIO is **bidirectional** — besides writing segment
data, the TM1637 can scan a key matrix and return it over DIO, so it's modeled `bidi`,
not write-only. 3.3–5 V.

## Verification
- Web sources: lastminuteengineers TM1637, makerguides TM1637, circuitdigest TM1637,
  Cirkit Designer TM1637 — agree on CLK/DIO/VCC/GND and the 2-wire (non-I²C) interface.
- Vault (`qmd_search`): no prior TM1637 note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).
- A bare single-digit / common-anode-or-cathode 7-segment is a separate future part.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-tm1637-display.md`
(never author `knowledge/` directly).
