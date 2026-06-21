---
summary: Arduino Nano (ATmega328P) — WEB-verified 30-pin board layout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: official Arduino Pinout-NANO PDF + zbotic + nextpcb + electronicshub (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# Arduino Nano (ATmega328P) — verification note

Added `core:arduino-nano` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. First **Tier-3 board**.

## Part
- **MPN:** Arduino Nano (ATmega328P, 16 MHz) — Tyler owns the **DCCduino** clone (same pinout)
- **Datasheet/pinout:** https://content.arduino.cc/assets/Pinout-NANO_latest.pdf
- **Class:** modeled `class: 'ic'`, refPrefix **A** (board/assembly)

## Pinout — 30 pins, two rows of 15 (verified)
**Left row (1–15):** D1/TX, D0/RX, RST, GND, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12
**Right row (16–30):** D13, 3V3, AREF, A0, A1, A2, A3, A4, A5, A6, A7, 5V, RST, GND, VIN

## Functions / ERC modeling
- **D0/D1** = UART RX/TX; **D10–D13** = SPI SS/MOSI/MISO/SCK; **D13** has the onboard LED.
- **A4/A5** = I²C SDA/SCL; **A6/A7** are **analog-INPUT only** (no digital, no pull-up).
- GPIO (D0–D13, A0–A5) modeled **bidi**; A6/A7 + AREF + RST modeled **input**.
- **3V3** (≤50 mA) and **5V** modeled **power_out** (onboard regulators source them);
  **VIN** (7–12 V) and **GND** modeled **power_in**.
- 2 GND pins (4, 29) and 2 RST pins (3, 28); names repeat but pin keys are unique.

## Verification
- Web sources: official Arduino Pinout-NANO PDF, zbotic Nano pinout, nextpcb Nano
  guide, electronicshub Nano — all agree on the 30-pin two-row layout and functions.
- Vault (`qmd_search`): no prior Nano note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (board land pattern deferred).
- DCCduino clone = identical pinout; a board-specific footprint would differ later.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-arduino-nano.md`
(never author `knowledge/` directly).
