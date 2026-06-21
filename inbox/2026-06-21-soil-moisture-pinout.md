---
summary: Soil moisture sensor module (FC-28, resistive YL-69+YL-38) — WEB-verified 4-pin comparator-board pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: components101 + Random Nerd Tutorials + Cirkit Designer YL-69/FC-28 + LM393 basis (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# Soil moisture sensor module (FC-28) — verification note

Added `core:soil-moisture` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. Fourth Tier-2 sensor; the resistive
FC-28 (KY-038 comparator-module pattern, analog + digital).

## Part
- **MPN:** FC-28 (YL-69 two-prong probe + YL-38 LM393 comparator board)
- **Reference:** https://components101.com/modules/soil-moisture-sensor-module
- **Function:** resistive soil-moisture measurement; DO trips at the pot threshold,
  AO is the continuous 0–VCC moisture level.
- **Class:** modeled `class: 'ic'`, refPrefix `U`

## Pinout — YL-38 board MCU header (verified)
| Pin | Name | Role | Electrical type (ERC) |
|----:|------|------|-----------------------|
| 1 | VCC | 3.3–5 V | power_in |
| 2 | GND | ground | power_in |
| 3 | DO | digital threshold (dry/wet) | output |
| 4 | AO | analog moisture level (0–VCC) | output |

## Probe note
The two-prong YL-69 probe is a separate piece that wires into the YL-38 comparator
board over a dedicated 2-pin screw terminal — **not modeled** as part of this header
(same stance as the ULN2003 motor socket / KY-038 mic element). We model the 4 pins a
user wires to the MCU.

## Variant note
A 3-pin **capacitive v1.2** soil sensor (VCC/GND/AOUT, analog-only, no comparator,
corrosion-resistant) is a separate future part. This part is the resistive FC-28.

## Verification
- Web sources: components101 soil-moisture module, Random Nerd Tutorials YL-69/HL-69,
  Cirkit Designer YL-69-LM393 — agree on VCC/GND/DO/AO and the YL-69+YL-38 split.
- Vault (`qmd_search`): no prior soil-moisture note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (module land pattern deferred).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-soil-moisture.md`
(never author `knowledge/` directly).
