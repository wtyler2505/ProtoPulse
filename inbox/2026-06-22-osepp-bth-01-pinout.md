---
summary: OSEPP BTH-01 Bluetooth Arduino board (ATmega328P + WT11) — photo-verified, Uno R3-compatible pinout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: Tyler's own board photos (images/OSEPP-BTH-01*.jpeg, BTH_01_*.jpg) + OSEPP product page
verified: 2026-06-22
---

# OSEPP BTH-01 Bluetooth Arduino board — verification note

Added `core:osepp-bth-01` to `@protopulse/parts`. Tyler owns it and supplied photos to
disambiguate it. Identity + form factor **visually verified from his own board images**.

## Part
- **MPN:** BTH-01 (OSEPP). ATmega328P @ 16 MHz + onboard **Bluegiga WT11** Bluetooth 2.1+EDR
  module + PL2303 USB-serial. Full Arduino Uno form factor, shield-compatible.
- **Class:** `ic`, refPrefix **A** (board). 32 pins. Footprint deferred.

## Identity correction (important)
The owner catalog conflated **BTH-01** (this Arduino MAIN BOARD) with OSEPP's separate
**BTM-01** (a small BC417/HC-06-style serial MODULE). A prior research pass flagged the
conflict; Tyler's board photos resolve it: the board has the full Uno form factor, standard
R3 header rows, an ICSP header, the WT11 module, and a PL2303 — it is unambiguously the
BTH-01 board, not a 4/6-pin serial module. No serial-module pinout was fabricated.

## Pinout — standard Arduino Uno R3 headers (32 pins)
Because the board is shield-compatible, its user-facing pinout IS the Uno R3 layout — net
assignment identical to `core:arduino-uno-r3`:
- POWER (8): NC (reserved corner), IOREF, RESET, 3V3, 5V, GND, GND, VIN
- ANALOG: A0–A5 (A4/A5 = I²C SDA/SCL)
- DIGITAL: D0(RX), D1(TX), D2–D13, then GND, AREF, SDA, SCL
- **D0(RX)/D1(TX) are shared with the onboard WT11 Bluetooth** (it sits on the hardware UART).

## ERC modeling
- GPIO (A0–A5, D0–D13, SDA/SCL) → **bidi**; RESET/AREF → **input**; IOREF/3V3/5V → **power_out**;
  VIN/GND → **power_in**; reserved corner → **nc**.

## Verification
- Visual: Tyler's board photos (`images/OSEPP-BTH-01 (Rev1.1).jpeg`,
  `images/BTH_01_1_-374-300-225-80.jpg`) — Uno form factor, R3 headers, ICSP, WT11, PL2303.
- OSEPP product page (BTH-01 = ATmega328P + WT11 board) corroborates.
- Pinout mirrors the already-verified `core:arduino-uno-r3` (official UNOrev3 PDF).

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-osepp-bth-01.md`
(never author `knowledge/` directly).
