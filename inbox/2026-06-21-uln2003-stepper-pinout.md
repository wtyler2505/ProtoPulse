---
summary: ULN2003 stepper driver board (28BYJ-48 companion) — WEB-verified control/power header for the @protopulse/parts seed library
category: hardware
provenance: verified
source: TI ULN2003A datasheet + lastminuteengineers + makerguides + DigiKey 28BYJ-48/ULN2003 tutorials (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# ULN2003 stepper driver board — verification note

Added `core:uln2003-stepper` to `@protopulse/parts`. Pinout **web-verified** — NOT
taken from Tyler's shared `docs/parts-components-ect.md`. First motor-driver part in
the breadth campaign.

## Part
- **MPN:** ULN2003 (board uses a ULN2003A 7-channel Darlington array)
- **Datasheet:** https://www.ti.com/lit/ds/symlink/uln2003a.pdf
- **Function:** drives the 28BYJ-48 5-wire unipolar stepper; 4 Darlington channels
  sink the motor phases, 4 LEDs indicate phase activity.
- **Class:** modeled `class: 'ic'`, refPrefix `U`

## Pinout — modeled control/power header (verified)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | IN1 | phase-A control from MCU | input |
| 2 | IN2 | phase-B control | input |
| 3 | IN3 | phase-C control | input |
| 4 | IN4 | phase-D control | input |
| 5 | VCC | motor power, 5 V (via enable jumper) | power_in |
| 6 | GND | ground | power_in |

## Modeling decision — motor socket NOT a header
The board has a keyed 5-pin JST socket that the 28BYJ-48's 5-wire connector plugs
into. That socket mates with the motor, not breadboard/MCU wiring, so it is
**intentionally not modeled** as header pins — we model only the 6 pins a user
actually wires (IN1–IN4 + VCC/GND). A removable jumper enables/disables motor power.

## Verification
- Web sources: TI ULN2003A datasheet, lastminuteengineers + makerguides + DigiKey
  28BYJ-48/ULN2003 tutorials — all agree on IN1–IN4 + VCC/GND + JST motor socket +
  enable jumper. Standard Arduino wiring: IN1–IN4 → D8–D11.
- Vault (`qmd_search`): no prior ULN2003 note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).
- 28BYJ-48 motor itself is a separate future part if a motor symbol is wanted.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-uln2003-stepper.md`
(never author `knowledge/` directly).
