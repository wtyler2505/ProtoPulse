---
summary: Arduino Uno R3 (ATmega328P) — WEB-verified 31-pin 4-header layout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: official Arduino Pinout-UNOrev3 PDF + circuito.io + deepbluembedded + etechnophiles (web-verified, NOT the shared component log)
verified: 2026-06-21
---

# Arduino Uno R3 (ATmega328P) — verification note

Added `core:arduino-uno-r3` to `@protopulse/parts`. Pinout **web-verified** — NOT taken
from Tyler's shared `docs/parts-components-ect.md`. Second Tier-3 board (iconic Uno).

## Part
- **MPN:** Arduino Uno R3 (ATmega328P, 16 MHz) — Tyler also owns the **OSEPP Uno R3 Plus** (same pinout)
- **Datasheet/pinout:** https://content.arduino.cc/assets/Pinout-UNOrev3_latest.pdf
- **Class:** modeled `class: 'ic'`, refPrefix **A** (board)

## Pinout — 31 modeled pins across 4 headers (verified)
- **POWER (1–7):** IOREF, RESET, 3V3, 5V, GND, GND, VIN
- **ANALOG (8–13):** A0, A1, A2, A3, A4, A5  (A4/A5 = I²C SDA/SCL)
- **DIGITAL lower (14–21):** D0/RX, D1/TX, D2, D3, D4, D5, D6, D7
- **DIGITAL upper (22–31):** D8, D9, D10, D11, D12, D13, GND, AREF, SDA, SCL

## Functions / ERC modeling
- **D0/D1** UART; **D10–D13** SPI (SS/MOSI/MISO/SCK); **PWM** on D3/5/6/9/10/11.
- R3 added **dedicated SDA/SCL** pins near AREF — electrically the **same ATmega nets
  as A4/A5**, exposed twice physically (both modeled).
- **IOREF** outputs the board's logic voltage to shields → modeled power_out.
- GPIO (D0–D13, A0–A5) **bidi**; RESET/AREF **input**; IOREF/3V3/5V **power_out**;
  VIN/GND **power_in**. (Board has 5 GND total; the 3 on the main headers are modeled.)

## Verification
- Web sources: official Arduino Pinout-UNOrev3 PDF, circuito.io Uno pinout,
  deepbluembedded Uno guide, etechnophiles Uno — all agree on the 4-header layout,
  R3 SDA/SCL+IOREF additions, and pin functions.
- Vault (`qmd_search`): no prior Uno note.
- Per Tyler's directive (2026-06-20): web-verified, never trusted from the shared doc.

## Modeling notes
- Schematic-only: **no footprint** (board land pattern deferred).
- OSEPP Uno R3 Plus = identical pinout.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-arduino-uno-r3.md`
(never author `knowledge/` directly).
