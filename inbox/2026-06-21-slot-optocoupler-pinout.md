---
summary: Slot-type IR optocoupler module (ITR9606 + LM393) — WEB-verified 3-pin pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: diymore + DAOKI + Geekstory + SAYAL LM393 slot-optocoupler listings + ITR9606 basis (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# Slot-type IR optocoupler module — verification note

Added `core:slot-optocoupler` to `@protopulse/parts`. Pinout **web-verified** — NOT
taken from Tyler's shared `docs/parts-components-ect.md`. Tier-2 sensor; a
photo-interrupter (beam-break across a slot), distinct from the reflective IR-obstacle.

## Part
- **MPN:** ITR9606-LM393 (ITR9606 slot photo-interrupter + LM393 comparator)
- **Reference:** https://www.diymore.cc/products/slot-type-ir-optocoupler-speed-sensor-module-lm393-for-arduino
- **Function:** 5 mm slot beam-break — encoder/speed/position sensing with a slotted
  chopper wheel.
- **Class:** modeled `class: 'ic'`, refPrefix `U`

## Pinout — verified signals (3-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | VCC | 3.3–5 V | power_in |
| 2 | GND | ground | power_in |
| 3 | DO | digital — LOW slot clear, HIGH when beam interrupted | output |

## Behavior note
IR emitter + phototransistor face each other across a 5 mm slot; LM393 squares the
output. DO is LOW when the slot is clear (LED on), HIGH when an object breaks the beam.
Pot sets sensitivity. Distinct from the reflective IR-obstacle sensor (this is
transmissive beam-break).

## Variant note
A 4-pin VCC/GND/DO/AO variant exists; the common LM393 speed-sensor board modeled here
is 3-pin digital-only.

## Verification
- Web sources: diymore, DAOKI, Geekstory, SAYAL LM393 slot-optocoupler product pages —
  agree on VCC/GND/DO and beam-break behavior; ITR9606 is the typical opto element.
- Vault (`qmd_search`): no prior slot-optocoupler note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-slot-optocoupler.md`
(never author `knowledge/` directly).
