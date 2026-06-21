---
summary: SW-420 vibration sensor module — WEB-verified 3-pin digital pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: components101 + microcontrollerslab + circuitdigest + SunFounder SW-420 + LM393 basis (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# SW-420 vibration sensor module — verification note

Added `core:sw420-vibration` to `@protopulse/parts`. Pinout **web-verified** — NOT
taken from Tyler's shared `docs/parts-components-ect.md`. Tier-2 sensor; mechanism is a
spring vibration switch (not an optical/comparator front-end like the others).

## Part
- **MPN:** SW-420 (spring vibration switch) + LM393 comparator
- **Reference:** https://components101.com/sensors/sw-420-vibration-sensor-module
- **Function:** detects vibration/shock; pot-tunable sensitivity, digital output.
- **Class:** modeled `class: 'ic'`, refPrefix `U`

## Pinout — verified signals (3-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | VCC | 3.3–5 V | power_in |
| 2 | GND | ground | power_in |
| 3 | DO | digital — LOW at rest, HIGH on vibration | output |

## Behavior note
The SW-420 spring switch is **normally-closed**: at rest DO reads LOW; vibration
momentarily opens the switch and DO goes HIGH. Onboard 10K pot sets sensitivity, LM393
squares the output. Digital-only (no analog).

## Verification
- Web sources: components101 SW-420, microcontrollerslab SW-420, circuitdigest SW-420,
  SunFounder Ultimate Sensor Kit vibration — agree on VCC/GND/DO and NC behavior.
- Vault (`qmd_search`): no prior SW-420 note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Variant note
Spring (SW-420), reed-switch, and piezo vibration variants exist; Tyler's log lists the
family. This part is the SW-420 spring module (the common one). Reed/piezo variants are
separate future parts if needed.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-sw420-vibration.md`
(never author `knowledge/` directly).
