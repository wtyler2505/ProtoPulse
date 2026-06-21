---
summary: Flame sensor module (IR photodiode + LM393) — WEB-verified 4-pin comparator-module pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: circuitdigest + SunFounder Ultimate Sensor Kit flame-sensor docs + LM393 basis (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# Flame sensor module — verification note

Added `core:flame-sensor` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. Second Tier-2 sensor; follows the
KY-038 comparator-module pattern with an IR-photodiode front-end.

## Part
- **MPN:** Flame-LM393 (generic IR-photodiode flame detector)
- **Reference:** https://docs.sunfounder.com/projects/ultimate-sensor-kit/en/latest/components_basic/03-component_flame.html
- **Function:** detects ~760–1100 nm IR from a flame; DO trips at the pot threshold,
  AO is the continuous IR level.
- **Class:** modeled `class: 'ic'`, refPrefix `U`

## Pinout — verified signals (4-pin variant)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | VCC | 3.3–5 V | power_in |
| 2 | GND | ground | power_in |
| 3 | DO | digital threshold out (flame detected) | output |
| 4 | AO | analog IR-level out | output |

## Variant note
A cut-down **3-pin** flame module (DO only, no AO) ships in some kits. Tyler owns the
**4-pin** version (DO + AO), which is what's modeled. Header silk order is board-
revision-dependent; pin names/functions are fixed. <7 mA draw.

## Verification
- Web sources: circuitdigest flame-sensor tutorial, SunFounder Ultimate Sensor Kit
  flame component, multiple LM393 flame-module listings — agree on VCC/GND/DO/AO.
- Vault (`qmd_search`): no prior flame-sensor note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).
- Same comparator-module family as KY-038 (see that note for the pattern).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-flame-sensor.md`
(never author `knowledge/` directly).
