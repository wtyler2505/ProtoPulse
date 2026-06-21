---
summary: Raspberry Pi 3 B+ — WEB-verified 40-pin J8 GPIO header for the @protopulse/parts seed library
category: hardware
provenance: verified
source: pinout.xyz + Pi4J model-3b-plus + etechnophiles Pi 3B+ (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# Raspberry Pi 3 B+ (40-pin GPIO header) — verification note

Added `core:raspberry-pi-3bp` to `@protopulse/parts`. Pinout **web-verified** — NOT
taken from Tyler's shared `docs/parts-components-ect.md`. Tier-3 SBC, modeled as its
GPIO header (schematic symbol only, per the tracker's "SBC, schematic-symbol only").

## Part
- **MPN:** Raspberry Pi 3 B+
- **Reference:** https://pinout.xyz/ (also Pi4J model-3b-plus, etechnophiles)
- **Class:** modeled `class: 'ic'`, refPrefix **A** (board)

## Pinout — standardized 40-pin J8 header (BCM numbering)
Odd physical pins = left column, even = right. Rails: **2×3V3** (pins 1, 17),
**2×5V** (2, 4), **8×GND** (6, 9, 14, 20, 25, 30, 34, 39). Buses: **I²C1** GPIO2/3
(pins 3, 5), **UART** GPIO14/15 (8, 10), **SPI0** GPIO7-11 (19, 21, 23, 24, 26),
**SPI1** GPIO16-21, PWM on GPIO12/13/18. GPIO0/1 (pins 27/28) = HAT ID EEPROM (ID_SD/
ID_SC).

## Ground-count note (caught during verification)
One source snippet claimed "9 ground pins"; the canonical pinout.xyz layout has **8**
grounds on the 40-pin header (6, 9, 14, 20, 25, 30, 34, 39). Modeled the verified 8 —
flagged here because it's a common miscount.

## ERC modeling
GPIO → **bidi**; 3V3 & 5V → **power_out** (the board sources these rails to HATs);
GND → **power_in**. The header layout is invariant across all 40-pin Pis (3B+/4/Zero
2/etc.), so this symbol is reusable.

## Verification
- Web sources: pinout.xyz (canonical), Pi4J model-3b-plus-rev1, etechnophiles Pi 3B+ —
  agree on the 40-pin J8 layout and BCM mapping.
- Vault (`qmd_search`): no prior Pi note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (board land pattern deferred); SBC modeled as its
  GPIO header. The Pi Display v1.1 (DSI) is a separate future part.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-raspberry-pi-3bp.md`
(never author `knowledge/` directly).
