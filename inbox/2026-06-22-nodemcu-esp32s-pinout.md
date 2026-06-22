---
summary: NodeMCU ESP-32S (Ai-Thinker NodeMCU-32S) — VISUALLY web-verified 38-pin ESP-WROOM-32 header for @protopulse/parts
category: hardware
provenance: verified
source: Mischianti high-res NODEMCU-32S pinout diagram (read in-browser, pin-by-pin) + espboards.dev/esp32/nodemcu-32s text cross-check
verified: 2026-06-22
---

# NodeMCU ESP-32S (38-pin) — verification note

Added `core:nodemcu-esp32s` to `@protopulse/parts`. Pinout **visually web-verified** — I
navigated to the Mischianti high-res "ESP32 NODEMCU-32S ESP-32S Kit" pinout (1440×842),
screenshotted it, and **zoomed both columns** to read every pin label, GPIO number, and
power rail by eye. Then cross-checked the bus assignments against espboards.dev text.

## The catalog was wrong — web won
Tyler's `docs/parts-components-ect.md` entry for "NodeMCU ESP-32S V1.1" is **internally
contradictory**: it claims chip "ESP32-S2" but also "Bluetooth 5.0". The ESP32-S2 has
**no Bluetooth at all** (Wi-Fi only) — so the catalog entry is an AI-generated error.
The board is the classic **dual-core ESP32 / ESP-WROOM-32** (Wi-Fi + BT/BLE), i.e. the
**Ai-Thinker NodeMCU-32S**. This is exactly why the standing rule is: the shared log is a
catalog of what Tyler owns, never a spec authority. Verified the real part from the web.

## Why this one needed the browser (and why every board now does)
The 38-pin board's two-row header order is a **board-specific rearrangement** of the
WROOM-32 module pads — it is NOT the module datasheet pad order, and it only lives in
pinout **diagram images** (WebFetch can't read them) and the board schematic. Text
sources (espboards, mischianti, snapeda, ai-thinker docs) all hide the ordered layout in
images. The flash-pin (GPIO6-11) placement is exactly where 38-pin variants diverge, so
guessing was off the table. Resolution: read the diagram visually in the browser.
**Per Tyler's directive 2026-06-22, this visual-diagram verification is now mandatory for
EVERY board, including a retroactive sweep of Nano / Uno / NodeMCU-ESP8266 / Pi 3B+.**

## Pinout — 38-pin header, continuous numbering (left 1–19, then right 20–38)
- **Left (1–19):** 3V3, EN, GPIO36(VP), GPIO39(VN), GPIO34, GPIO35, GPIO32, GPIO33,
  GPIO25, GPIO26, GPIO27, GPIO14, GPIO12, GND, GPIO13, GPIO9, GPIO10, GPIO11, 5V(VIN).
- **Right (20–38):** GND, GPIO23(MOSI), GPIO22(SCL), GPIO1(U0TXD), GPIO3(U0RXD),
  GPIO21(SDA), GND, GPIO19(MISO), GPIO18(SCK), GPIO5(CS), GPIO17(U2TXD), GPIO16(U2RXD),
  GPIO4, GPIO0, GPIO2, GPIO15, GPIO8, GPIO7, GPIO6.
- **All six SPI-flash pins broken out:** GPIO9/10/11 = SD2/SD3/CMD (left bottom),
  GPIO8/7/6 = SD1/SD0/CLK (right bottom). Occupied by the onboard SPI flash — using them
  as GPIO crashes the board (modeled bidi, flagged in the note).

## ERC modeling
- **GPIO34/35/36/39 → input** (ESP32 input-only pins: no output drivers, no pull-ups).
- **EN → input** (chip enable / reset).
- **3V3 → power_out** (onboard AMS1117 regulator sources the rail).
- **5V/VIN + GND → power_in.**
- **All other GPIO → bidi** (including the strapping pins 0/2/5/12/15 and flash pins 6-11).

## Verification
- Visual: Mischianti NODEMCU-32S diagram, both columns zoomed and read pin-by-pin.
- Cross-check (espboards.dev): SDA=GPIO21, SCL=GPIO22, MOSI=GPIO23, MISO=GPIO19,
  SCK=GPIO18, CS=GPIO5, U0TXD=GPIO1/U0RXD=GPIO3, U2=GPIO16/17, VP=GPIO36/VN=GPIO39 — all agree.
- Vault (`qmd_search`): no prior NodeMCU-32S note.

## Modeling notes
- Schematic-only: **no footprint** (board land pattern deferred). Modeled as its 38-pin header.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-nodemcu-esp32s.md`
(never author `knowledge/` directly).
