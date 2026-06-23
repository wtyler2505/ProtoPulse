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
- [x] `core:max7219` — MAX7219 LED matrix driver module (SPI, daisy-chain; web-verified). `dd5226b3`
- [x] `core:lcd1602` — 1602A 16x2 character LCD (HD44780, 16-pin parallel; web-verified). `a55121c1`
- [x] `core:rc522` — RC522 RFID reader module (NXP MFRC522, SPI; web-verified). `611f031a`
- [x] `core:tb6612fng` — TB6612FNG dual motor driver (Toshiba MOSFET H-bridge; web-verified). `482c6132`

**Tier-1 is COMPLETE** (8/8): MPU-6050, DS1302, DS3231, ULN2003, L298N, TB6612FNG, MAX7219, 1602A LCD, RC522 all landed + web-verified (2026-06-21). Next: Tier-2 sensor modules.

### Tier-2 (in progress)
- [x] `core:ky038` — KY-038 sound sensor (LM393 comparator module; web-verified). `3ccc12fb`
- [x] `core:flame-sensor` — Flame sensor module (IR photodiode + LM393; web-verified). `23bfbae0`
- [x] `core:ir-obstacle` — IR obstacle-avoidance sensor (3-pin digital, active-low; web-verified). `f55dc4d4`
- [x] `core:soil-moisture` — Soil moisture sensor (FC-28 resistive, 4-pin; web-verified). `2dcc3a01`
- [x] `core:ttp223` — TTP223 capacitive touch sensor (3-pin push-pull; web-verified). `814eb4bd`
- [x] `core:ky006-buzzer` — KY-006 passive buzzer (3-pin, MCU-driven tone; web-verified). `d722b48c`
- [x] `core:sw420-vibration` — SW-420 vibration sensor (3-pin digital, NC spring switch; web-verified). `8699e23a`
- [x] `core:ky008-laser` — KY-008 laser diode module (3-pin emitter, 650nm; web-verified). `275d0c38`
- [x] `core:ky022-ir-receiver` — KY-022 IR receiver (38kHz, VS1838B; web-verified). `0ebc6d3b`
- [x] `core:ky005-ir-transmitter` — KY-005 IR transmitter (940nm IR LED; web-verified). `c343b70f`
- [x] `core:slot-optocoupler` — Slot-type IR optocoupler (ITR9606 + LM393, 3-pin; web-verified). `e44a9ce7`
- [x] `core:ky016-rgb-led` — KY-016 RGB LED module (4-pin common-cathode; web-verified). `12a1cb0c`
- [x] `core:tm1637-display` — TM1637 4-digit 7-segment display (4-pin 2-wire; web-verified). `91834332`
- [x] `core:ky004-button` — KY-004 button module (3-pin pull-down, active-high; web-verified). `7ffabbe4`
- [x] `core:hc-sr04` — HC-SR04 ultrasonic distance sensor (4-pin VCC/TRIG/ECHO/GND; diagram-verified vs ElecFreaks datasheet). 2026-06-22
- [x] `core:hc-sr501` — HC-SR501 PIR motion sensor (3-pin **GND/OUT/VCC**; diagram-verified — corrected from VCC/OUT/GND, a text-table error caught by the visual audit). 2026-06-22
- [x] `core:ky040-encoder` — KY-040 rotary encoder (5-pin CLK/DT/SW/+/GND; diagram-verified). 2026-06-22
- [x] `core:ky023-joystick` — KY-023 dual-axis analog joystick (5-pin GND/+5V/VRx/VRy/SW; diagram-verified). 2026-06-22
- [x] `core:l293d` — L293D dual H-bridge motor driver IC (DIP-16; diagram-verified vs TI datasheet pg.3). 2026-06-22
- [x] `core:srd-05vdc-relay` — Songle SRD-05VDC-SL-C SPDT relay (5-pin, 2 coil + COM/NO/NC; diagram-verified — datasheet assigns no pin numbers, flat 1..5 OK for symbol). 2026-06-22
- [x] `core:pot-10k` — 10K rotary potentiometer (3-terminal A/WIPER/B; diagram-verified middle=wiper, fills variable-resistor gap). 2026-06-22
- [x] `core:p30n06le` — P30N06LE/RFP30N06LE logic-level N-MOSFET (TO-220 1=G/2=D/3=S; diagram-verified vs Fairchild datasheet — function labels + tab=Drain confirmed; numbering is standard TO-220AB convention). 2026-06-22

> **Verification audit 2026-06-22** — all 8 of the parts above through `p30n06le` were re-verified by VISUAL inspection of authoritative pinout diagrams/datasheets read as images (per the board-diagram-verification standard, extended to every part). Result: 7/8 already correct; **HC-SR501 was corrected** (VCC/OUT/GND → GND/OUT/VCC — a text table had the end pins reversed from the actual board pictures). Lesson logged: text scraping ≠ visual verification; the picture is ground truth.
- [x] `core:hw221-level-shifter` — **HW-221 (YF08E) 8-channel bidirectional level converter — UNPARKED + done, diagram-verified.** 20 pins, two rows: low side **VA/A1–A8/OE**, high side **VB/B1–B8/GND** (channels paired across; OE↔GND). The viewed diagram CORRECTED the catalog (which had no OE and put GND on the low side) — the bottom A-side pin is OE (active-HIGH enable), GND is on the B side. TXS0108E-equivalent. 2026-06-22
- [ ] **Membrane Switch Module — PARKED, ambiguous.** Log entry (line 1086) is vague ("multiple tactile switches + status LEDs", no pin labels/count); the cheap membrane modules vary (3-button vs 4-button, LED-per-key vs not, differing pin order). Needs Tyler's exact module identified + a diagram before modeling. Do NOT fabricate.

## Remaining queue (needs browser/diagram passes — do in a FRESH session, not at a context wall)
The clean, datasheet-/text-verifiable parts Tyler owns are now harvested (11 parts landed 2026-06-22). What's left needs visual verification or is a low-value variant of an existing part:
- **Browser/diagram passes:** ~~HW-221 level converter~~ DONE (diagram-verified, see above); OSEPP/SainSmart/DK/Velleman shields (line 323/363/566/609/649/690/730); 2.8" TFT LCD shield (966); membrane module (parked above).
- **2.8" TFT LCD shield — ASSESSED 2026-06-22, KEEP PARKED.** Diagram/photo verification confirms it's a **parallel 8-bit Arduino-Uno-stackable MCUFRIEND shield** (bent shield-leg headers all four sides, onboard microSD, silk `LCD_RST/CS/RS/WR/RD` + `GND/5V/3V3/RESET`), NOT a clean SPI module — its pins ARE the Uno's pins, so it's a shield FOOTPRINT/overlay, not a normal library part. Catalog "ili9338" is a typo for **ILI9341** (most likely; controller varies by batch — ILI9325/9328 also seen). Exact controller + resistive-touch pin order need the physical unit's `readID()` on the bench. Standard MCUFRIEND map (if ever modeled as a shield overlay): data LCD_D0=D8…LCD_D7=D7; ctrl RD=A0/WR=A1/RS=A2/CS=A3/RST=A4; SD on D10–D13. Revisit when the shield/overlay part-type exists AND Tyler runs readID() on his board.
- [x] `core:esp8266ex` — **ESP8266EX bare WiFi SoC (QFN-32) — done, datasheet-verified.** 33 pins (32 signal + center GND pad), per official Espressif datasheet v7.1 Table 2-1. The raw chip for custom PCBs (distinct from the NodeMCU modules). 2026-06-22
- [x] `core:led-matrix-1088as` — **1088AS 8×8 LED dot matrix — done, diagram-verified.** 16-pin, common-cathode by row; non-linear pin→row/col map from the TOPLITE datasheet. Pairs with the modeled MAX7219. 2026-06-22
- [x] `core:seg7-5161as` — **5161AS single-digit 7-segment — done, diagram-verified.** 10-pin, common-cathode (commons 3+8); segment map from the XLITX datasheet. 2026-06-22
- **Low-value variants of already-added parts (skip unless asked):** sound-sensor alt variant (1171), single LED module (1605), vibration reed/spring variants (1703/1752/2113), sound-detection variant (3321), IR-obstacle dup (3409), RC522 remote (1046), OSEPP IR follower (888), OSEPP solderable breadboards (810/849).
- **PARKED (need Tyler's physical board / a clean diagram before modeling):**
  - **OSEPP-BTH-01** — catalog conflated it: "BTH-01" is actually an OSEPP Arduino MAIN board (ATmega328P + Bluegiga WT11), NOT the BC417 serial module. The BC417/HC-06-style serial module is OSEPP's separate **BTM-01**. Need Tyler to confirm which physical board he has before modeling either.
  - **HS420561K-32** 4-digit 7-seg — CC corroborated but the exact pin numbering couldn't be visually confirmed (generic clone, no datasheet, pinout image blocked). Needs a diagram or bench continuity check.
  - **Velleman W5100 Ethernet Shield** — shield-overlay (W5100 + Arduino R3 header passthrough), same architecture question as the TFT shield: model-as-shield-overlay vs raw LQFP-80 chip. Parked pending a shield/overlay part-type.

## High-value candidates from the component log (suggested priority)
Tier 1 — common, well-documented, high reuse:
- [x] MPU-6050 — I²C 6-axis IMU (GY-521 module) — addr 0x68/0x69 — done `core:mpu6050` (8-pin VCC/GND/SCL/SDA/XDA/XCL/AD0/INT; diagram-reconfirmed 2026-06-22)
- [x] DS1302 RTC module (3-wire serial) — done `53e2a084`. (DS1307 remains — it IS I²C)
- [x] DS3231 RTC module (ZS-042, I²C) — done `372374b7`
- [x] ULN2003 stepper driver module (+ 28BYJ-48 pairing) — done `22295bbb`
- [x] L298N dual H-bridge motor driver — done `bbe20b15`
- [x] TB6612 motor driver (OSEPP shield variant) — done `482c6132`
- [x] MAX7219 dot-matrix / 7-seg driver — done `dd5226b3`
- [x] 1602A LCD (HD44780) display module — done `a55121c1`
- [x] RC522 RFID module (SPI) — done `611f031a`

Tier 2 — sensor modules (mostly simple 3-4 pin digital/analog):
- [x] KY-038 sound sensor — done `3ccc12fb` (sound detection sensor variant still open)
- [x] Flame sensor module — done `23bfbae0`
- [x] Vibration sensor module — done `8699e23a` (SW-420 spring; reed/piezo variants still open)
- [x] IR obstacle-avoidance sensor — done `f55dc4d4`. IR receiver 38 kHz — done `0ebc6d3b` (KY-022). IR LED transmitter — done `c343b70f` (KY-005).
- [x] Soil moisture sensor module — done `2dcc3a01` (resistive FC-28; capacitive v1.2 still open)
- [x] Capacitive touch sensor module — done `814eb4bd` (TTP223)
- [x] Slot-type optocoupler module — done `e44a9ce7`
- [x] Passive buzzer module — done `d722b48c` (KY-006). Laser diode module — done `275d0c38` (KY-008).
- [x] RGB LED module — done `12a1cb0c` (KY-016). Tactile button module — done `7ffabbe4` (KY-004). (single LED module still open)
- [x] 4-digit 7-segment display — done `91834332` (TM1637). (single-digit 7-seg + 8x8 dot matrix still open)

Tier 3 — boards/shields (larger pin counts; model as modules, footprint deferred):
- [x] **Arduino Nano (ATmega328P)** — done `a9a729b1` (DCCduino clone; 30-pin, web-verified)
- [x] NodeMCU Amica (ESP8266) — done `0fca4a23`. NodeMCU ESP-32S V1.1 (Ai-Thinker NodeMCU-32S, 38-pin) — done, VISUALLY verified. (ESP8266EX, Sparkfun Blynk Board still open)
- [x] Arduino Uno R3 / OSEPP Uno R3 Plus — done `86b285d0`. Nano DCCduino — done `a9a729b1`. Arduino MEGA 2560 R3 (86-pin, all 5 headers) — done, VISUALLY verified. (MEGA proto-shield host board still open)
- [x] Raspberry Pi 3 B+ (40-pin GPIO header) — done `bb24e1b1`. (Pi Display v1.1 still open)
- [ ] Motor/servo/sensor shields (OSEPP, SainSmart, DK Electronics, Velleman Ethernet)

The full ordered list lives in the component log's Table of Contents.

## Board verification protocol (MANDATORY — Tyler's directive 2026-06-22)
Boards/dev-boards are NOT adequately verifiable from text. A board's physical header
order is a board-specific rearrangement that lives only in pinout **diagram images** and
the board schematic — WebFetch/curl can't read it, and the module datasheet gives the
wrong (pad) order. **Every board MUST be verified by VISUAL inspection of a high-res
pinout diagram in the browser** (navigate → screenshot → zoom each column → read
pin-by-pin), then cross-checked against an independent text source for bus assignments.
"Two columns of text labels in an image" = browser, not WebFetch.

### Retroactive visual-verification sweep (boards already shipped from text) — COMPLETE 2026-06-22
All boards visually verified against authoritative diagrams. Record: `inbox/2026-06-22-board-visual-verification-sweep.md`.
- [x] NodeMCU ESP-32S (38-pin) — verified at creation (Mischianti NODEMCU-32S diagram). `a911a791`
- [x] Arduino Nano (`core:arduino-nano`) — official Arduino Pinout-NANO PDF; CORRECT, no change.
- [x] Arduino Uno R3 (`core:arduino-uno-r3`) — official Arduino Pinout-UNOrev3 PDF; **FIXED**: added the reserved/NC corner pin (31→32 pins).
- [x] NodeMCU ESP8266 Amica (`core:nodemcu-esp8266`) — Mischianti NodeMCU-V2 CP2102 diagram; CORRECT, no change.
- [x] Raspberry Pi 3 B+ (`core:raspberry-pi-3bp`) — pinout.xyz structured DOM, all 40 pins exact-match; CORRECT, no change.

## Notes
- Footprints stay deferred until a datasheet-exact land pattern is done (the seed
  library's standing convention).
- Modules (breakouts) are modeled like the ESP32-S3-WROOM-1 module: schematic symbol
  + header pins, no invented footprint.
