# Parts-library breadth — from Tyler's component log

**Source of truth for what to add:** `docs/parts-components-ect.md` (Tyler's
personal "Component Log for Arduino and Electronics" — 3,577 lines, ~64 entries,
with datasheet-grade pinouts/specs/application notes for the hardware he actually
owns). That doc is BOTH the catalog (what to add) and a verification source (its
pinouts are curated, but still cross-check against the manufacturer datasheet per
the Hardware & Component Verification Protocol).

**Goal:** grow `@protopulse/parts` (`packages/parts/src/seed/index.ts`) so Tyler's
real bench inventory is representable in ProtoPulse schematics/breadboards — on top
of the now-certified ESP32-S3 emulator base.

## Per-part workflow (one bounded slice each)
1. Use `docs/parts-components-ect.md` ONLY to know which part Tyler owns (identity/variant).
2. **WEB-VERIFY** every pinout/address/spec against the manufacturer datasheet +
   authoritative sources (NEVER trust the shared component log alone — Tyler's
   explicit rule, 2026-06-20). Cite the URLs. No guessed pins.
3. Add to `packages/parts/src/seed/index.ts` via `definePart()` — datasheet pin
   numbers, schematic symbol, footprint **deferred** unless a verified land pattern
   exists (note the deferral, like ESP32/TMP36/BME280).
4. `provenance: 'verified'` + a `provenanceNote` citing the datasheet + a
   `inbox/<date>-<part>-pinout.md` provenance note (route to `knowledge/` via
   `/extract` later — never write `knowledge/` directly).
5. Add a pin-map test in `packages/parts/src/parts.test.ts` and append the id to the
   verified-parts list assertion. `npm run -w @protopulse/parts test` + `check:packages`.
6. Commit; verify it shows in the live palette.

## Already added (this track)
- [x] `core:tmp36` — TMP36 analog temperature sensor (analog/ADC path). `3d0f7d62`
- [x] `core:bme280` — BME280 I²C temp/humidity/pressure (I²C path). `51b8c466`
- [x] `core:mpu6050` — GY-521 (MPU-6050) 6-axis IMU (I²C path, web-verified).
- [x] `core:ds1302` — DS1302 RTC module (3-wire serial, NOT I²C; web-verified). `53e2a084`
- [x] `core:ds3231` — DS3231 RTC module (ZS-042, I²C addr 0x68; web-verified). `372374b7`
- [x] `core:uln2003-stepper` — ULN2003 stepper driver board (28BYJ-48 companion; web-verified). `22295bbb`
- [x] `core:l298n` — L298N dual H-bridge motor driver (web-verified). `bbe20b15`

## High-value candidates from the component log (suggested priority)
Tier 1 — common, well-documented, high reuse:
- [ ] MPU-6050 — I²C 6-axis IMU (GY-521 module) — addr 0x68/0x69
- [x] DS1302 RTC module (3-wire serial) — done `53e2a084`. (DS1307 remains — it IS I²C)
- [x] DS3231 RTC module (ZS-042, I²C) — done `372374b7`
- [x] ULN2003 stepper driver module (+ 28BYJ-48 pairing) — done `22295bbb`
- [x] L298N dual H-bridge motor driver — done `bbe20b15`
- [ ] TB6612 motor driver (OSEPP shield variant)
- [ ] MAX7219 dot-matrix / 7-seg driver
- [ ] 1602A LCD (HD44780) display module
- [ ] RC522 RFID module (SPI)

Tier 2 — sensor modules (mostly simple 3-4 pin digital/analog):
- [ ] KY-038 sound sensor, sound detection sensor
- [ ] Flame sensor module
- [ ] Vibration sensor modules (spring / reed / piezo variants)
- [ ] IR obstacle-avoidance sensor, IR receiver (38 kHz), IR LED transmitter
- [ ] Soil moisture sensor module
- [ ] Capacitive touch sensor module
- [ ] Slot-type optocoupler module
- [ ] Passive buzzer module, laser diode module
- [ ] RGB LED modules, single LED module, tactile button module
- [ ] 4-digit / single-digit 7-segment display, 8x8 LED dot matrix

Tier 3 — boards/shields (larger pin counts; model as modules, footprint deferred):
- [ ] NodeMCU ESP-32S V1.1, NodeMCU Amica, ESP8266EX, Sparkfun Blynk Board
- [ ] Arduino Uno R3 / OSEPP Uno R3 Plus, Nano DCCduino, Arduino MEGA proto shield
- [ ] Raspberry Pi 3 B+ (+ Pi Display v1.1) — SBC, schematic-symbol only
- [ ] Motor/servo/sensor shields (OSEPP, SainSmart, DK Electronics, Velleman Ethernet)

The full ordered list lives in the component log's Table of Contents.

## Notes
- Footprints stay deferred until a datasheet-exact land pattern is done (the seed
  library's standing convention).
- Modules (breakouts) are modeled like the ESP32-S3-WROOM-1 module: schematic symbol
  + header pins, no invented footprint.
