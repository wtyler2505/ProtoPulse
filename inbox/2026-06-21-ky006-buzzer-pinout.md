---
summary: KY-006 passive buzzer module — WEB-verified 3-pin output-transducer pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: thegeekpub + espboards + arduinomodules + joy-it SensorKit KY-006 (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# KY-006 passive buzzer module — verification note

Added `core:ky006-buzzer` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. First **output transducer** in the
Tier-2 set (all prior Tier-2 parts were sensor inputs).

## Part
- **MPN:** KY-006 (passive piezo buzzer; HW-508 is the same board)
- **Reference:** https://sensorkit.joy-it.net/en/sensors/ky-006
- **Function:** passive piezo sounder — produces tone only when driven by an external
  square wave.
- **Class:** modeled `class: 'ic'`, refPrefix **LS** (loudspeaker/sounder designator)

## Pinout — verified signals (3-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | S | square-wave drive from MCU (tone()) | input |
| 2 | VCC | middle pin — often NC on KY-006/HW-508 | power_in |
| 3 | GND | ground | power_in |

## Passive vs active note
**Passive** buzzer = no onboard oscillator: the MCU must supply the waveform
(`tone(pin, freq)`), so it can play any pitch (~1.5–2.5 kHz range, loudest near
2 kHz). Contrast the **active** KY-012, which self-oscillates at a fixed pitch when
powered. On most KY-006/HW-508 boards the middle VCC pin is **NC** — practically you
wire S → GPIO and – → GND.

## Verification
- Web sources: thegeekpub KY-006 wiki, espboards KY-006, arduinomodules KY-006,
  joy-it SensorKit KY-006 — agree on S/middle/GND and passive-buzzer behavior.
- Vault (`qmd_search`): no prior KY-006 note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).
- S modeled as an input to the module (the MCU output drives it).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-ky006-buzzer.md`
(never author `knowledge/` directly).
