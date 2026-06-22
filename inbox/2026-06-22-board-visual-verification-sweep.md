---
summary: Retroactive VISUAL pinout verification of every board in @protopulse/parts (Tyler directive 2026-06-22)
category: hardware
provenance: verified
source: Official Arduino Pinout PDFs (Nano, UNOrev3) + Mischianti NodeMCU-V2 CP2102 diagram + pinout.xyz DOM (web, visual)
verified: 2026-06-22
---

# Board pinout visual-verification sweep — 2026-06-22

Tyler's directive: **"THIS NEEDS TO BE DONE FOR ALL BOARDS"** — i.e. every board in the
seed library must be verified by VISUAL inspection of an authoritative pinout diagram, not
just text. Rationale: a board's physical header order is a board-specific rearrangement
that lives only in diagram images / the board schematic; WebFetch and the module datasheet
don't give it. Sweep results below. The protocol is now recorded in
`docs/parts-library-breadth.md` (Board verification protocol section).

## Results

| Board | id | Source diagram | Verdict |
|---|---|---|---|
| NodeMCU ESP-32S (38-pin) | `core:nodemcu-esp32s` | Mischianti NODEMCU-32S (in-browser, both cols zoomed) | ✅ created + verified |
| Arduino Nano | `core:arduino-nano` | Official Arduino `Pinout-NANO` PDF (rendered, read pin-by-pin) | ✅ correct, no change |
| Arduino Uno R3 | `core:arduino-uno-r3` | Official Arduino `Pinout-UNOrev3` PDF (rendered, read pin-by-pin) | ⚠️→✅ **fixed** (see below) |
| NodeMCU ESP8266 (Amica) | `core:nodemcu-esp8266` | Mischianti NodeMCU-V2 CP2102 (in-browser) | ✅ correct, no change |
| Raspberry Pi 3 B+ | `core:raspberry-pi-3bp` | pinout.xyz (structured DOM extract, all 40 pins) | ✅ correct, no change |

## Arduino Uno R3 — the one correction
The official Arduino UNOrev3 diagram shows the **power header has 8 pins**, the first
(corner) being a **reserved / NC** pin: `NC, IOREF, RESET, 3V3, 5V, GND, GND, VIN`. The
earlier text-only model omitted the NC pin (31 pins). Fixed to **32 pins** with `NC`
modeled `electricalType: 'nc'` at position 1 (consistent with how the ESP8266 models its
`RSV` reserved pins). All other Uno signals/sequences already matched the diagram
(D13=SCK, D12=CIPO/MISO, D11=COPI/MOSI, D10=SS; A4/A5 + dedicated SDA/SCL = I²C; AREF/RESET
input; IOREF/3V3/5V power_out). Also noted VIN is 7–12 V recommended / **6–20 V abs max**
per the official diagram (comment updated; parametric maxVoltage left at the 12 V
recommended ceiling).

## Notes that held up under visual check
- **Nano:** seed groups digital pins on one symbol side and analog/power on the other; the
  official silk has them on opposite strips, but the adjacency sequence is identical — the
  pin-number index is a clean schematic layout, not a physical silk position. Names/functions
  100% correct (A6/A7 ADC-only → input; AREF/RESET → input; two RESET pins present).
- **ESP8266:** every D-label→GPIO mapping confirmed (D0=16, D1=5/SCL, D2=4/SDA, D3=0, D4=2,
  D5=14, D6=12, D7=13, D8=15, RX=3, TX=1); SD0–SD3/CMD/CLK = GPIO7/8/9/10/11/6 flash bus.
- **Pi 3 B+:** all 40 J8 pins exact-match pinout.xyz; 8 grounds confirmed (the "9 grounds"
  miscount from a prior web snippet stays debunked).

## Pipeline
Route to `knowledge/` via `/extract` later (e.g. `hardware-board-pinout-verification.md`);
never author `knowledge/` directly.
