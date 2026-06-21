---
summary: IR obstacle-avoidance sensor module — WEB-verified 3-pin digital pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: Cirkit Designer + osoyoo + multiple IR-obstacle module pinouts + LM393 basis (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# IR obstacle-avoidance sensor module — verification note

Added `core:ir-obstacle` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. Third Tier-2 sensor; distinct from
the KY-038/flame 4-pin modules in being an **active** emitter+receiver with a
**3-pin, digital-only** interface.

## Part
- **MPN:** IR-Obstacle-LM393 (IR LED emitter + photodiode + LM393)
- **Reference:** https://osoyoo.com/2018/12/21/ir-obstacle-avoidance-module/
- **Function:** reflective obstacle detection ~2–20 cm, 35° cone, pot-tunable range.
- **Class:** modeled `class: 'ic'`, refPrefix `U`

## Pinout — verified signals (3-pin)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | VCC | 3.3–5 V | power_in |
| 2 | GND | ground | power_in |
| 3 | OUT | digital, active-LOW on detection | output |

## Behavior note
OUT goes **LOW** when reflected IR exceeds the pot threshold (obstacle present) — it
is active-low. No analog output (unlike KY-038/flame). Onboard power LED + obstacle
LED.

## Verification
- Web sources: Cirkit Designer IR-sensor-LM393, osoyoo IR-obstacle lesson, multiple
  module listings — agree on the 3-pin VCC/GND/OUT and active-low behavior.
- Vault (`qmd_search`): no prior IR-obstacle note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-ir-obstacle.md`
(never author `knowledge/` directly).
