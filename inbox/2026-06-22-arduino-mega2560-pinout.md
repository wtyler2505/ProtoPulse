---
summary: Arduino MEGA 2560 R3 — VISUALLY web-verified 86-pin layout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: Official Arduino Pinout-Mega2560rev3 PDF (all 4 pages, read pin-by-pin)
verified: 2026-06-22
---

# Arduino MEGA 2560 R3 — verification note

Added `core:arduino-mega2560` to `@protopulse/parts`. Pinout **visually verified** against
the **official Arduino Pinout-Mega2560rev3 PDF** — all 4 pages downloaded and read
pin-by-pin (the bottom D22–D53 double-row header is on its own page; page 1 only shows the
shield-compatible headers, so reading every page mattered). This was the other large board
that the new mandatory board-diagram-verification protocol unblocked.

## Part
- **MPN:** Arduino Mega 2560 Rev3 (ATmega2560)
- **Reference:** official Arduino store pinout PDF (`content.arduino.cc/assets/Pinout-Mega2560rev3_latest.pdf`)
- **Class:** `ic`, refPrefix **A** (board). 86 modeled header pins. Footprint deferred.

## The five headers (86 pins, continuous numbering)
1. **POWER (8):** NC, IOREF, RESET, 3V3, 5V, GND, GND, VIN — corner pin reserved/NC.
2. **ANALOG (16):** A0–A15 (= D54–D69). A4–A7 double as the JTAG TCK/TMS/TDO/TDI pins.
3. **DIGITAL shield header (18):** dedicated SCL, SDA, AREF, GND, then D13→D0. D13 = onboard
   LED; PWM on D2–D13.
4. **COMM header (8):** D14–D21 = TX3/RX3, TX2/RX2, TX1/RX1, SDA(D20), SCL(D21).
5. **BOTTOM 2×18 header (36):** left col = 5V, even D22–D52, GND; right col = 5V, odd
   D23–D53, GND. SPI on D50=CIPO/MISO, D51=COPI/MOSI, D52=SCK, D53=SS.

## Generation method (no-shortcuts)
86 pins + 86 symbol coordinates is too error-prone to hand-type, so the `definePart`
pins/symbol arrays were **generated deterministically** from a verified pin list
(`tmp/gen-mega.js`), reviewed, then inserted — correct-by-construction on-grid coordinates.

## ERC modeling
- All digital (D0–D53) + analog (A0–A15) pins → **bidi**.
- AREF, RESET → **input**.
- IOREF, 3V3, 5V (incl. the 2 bottom-header 5V) → **power_out**.
- VIN, GND (5 of them) → **power_in**. NC → **nc**.
- VIN 7–12 V recommended, **6–20 V abs max** (official diagram).

## Verification
- Source: official Arduino pinout PDF, all 4 pages, read visually.
- Cross-reference: ATmega2560 port mapping (PA/PC/PL/PG etc.) recorded in pin comments,
  consistent with the Arduino MEGA core. D-number ↔ port mapping per the official diagram.
- Vault (`qmd_search`): no prior MEGA note.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-arduino-mega2560.md`
(never author `knowledge/` directly).
