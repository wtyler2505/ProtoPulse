---
summary: 1088AS 8x8 LED dot matrix (common-cathode) — diagram-verified 16-pin row/col map for the @protopulse/parts seed library
category: hardware
provenance: verified
source: TOPLITE TOP-CC-1088AS-N4 datasheet internal-matrix diagram (visually verified)
verified: 2026-06-22
---

# 1088AS 8×8 LED dot matrix — verification note

Added `core:led-matrix-1088as` to `@protopulse/parts`. Tyler owns it (catalog 8×8 dot matrix).
Pairs with the already-modeled MAX7219 driver. Pinout **diagram-verified**.

## Part
- **MPN:** 1088AS (TOPLITE TOP-CC-1088AS-N4). **Common-cathode by row.**
- **Class:** `led`, refPrefix **DS**. 16 pins. Footprint deferred.

## Pinout — 16 pins, COMMON-CATHODE
Each LED's anode = its COLUMN line, cathode = its ROW line. Light an LED by driving its
COLUMN HIGH and pulling its ROW LOW. Pin→row/col map is **NOT linear** (datasheet diagram):
- **Columns:** COL1=13, COL2=3, COL3=4, COL4=10, COL5=6, COL6=11, COL7=15, COL8=16
- **Rows:** ROW1=9, ROW2=14, ROW3=8, ROW4=12, ROW5=1, ROW6=7, ROW7=2, ROW8=5

## ERC modeling
- All 16 pins → **passive** (bare LED-array terminals; no active drive on the matrix itself).

## Verification
- Visual: makerguides-hosted TOP-CC-1088AS-N4 datasheet internal diode-matrix diagram, read
  as an image — confirms CC-by-row + the non-linear pin map above.
- The common-anode sibling is the **1088BS**; this is the **AS = CC** part.
- Vault (`qmd_search`): no prior 1088AS note.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-led-matrix-1088as.md`
(never author `knowledge/` directly).
