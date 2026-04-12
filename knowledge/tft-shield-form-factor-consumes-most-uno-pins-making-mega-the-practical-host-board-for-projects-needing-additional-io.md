---
description: "The ILI9341 TFT touch shield uses SPI (MOSI/MISO/SCK via ICSP), D8-D10 for display control, and A0-A3 for resistive touch — on an Uno this leaves almost no free pins, making the Mega 2560 the practical host for projects needing sensors or actuators alongside the display"
type: claim
source: "docs/parts/2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
  - "[[shields]]"
  - "[[microcontrollers]]"
---

# TFT shield form factor consumes most Uno pins making Mega the practical host board for projects needing additional IO

The ILI9341 TFT touch shield in Arduino Uno form factor occupies an enormous footprint of the Uno's limited I/O:

**Pins consumed by the shield:**
- D10 — TFT chip select (CS)
- D9 — TFT data/command (DC)
- D8 — TFT reset (some variants)
- ICSP header — SPI bus (MOSI, MISO, SCK)
- A0, A1, A2, A3 — resistive touch (XP, XM, YP, YM)

**Pins remaining on Uno after shield is mounted:**
- D0-D7 (D0/D1 are Serial, so realistically D2-D7 = 6 digital pins)
- A4, A5 (also I2C SDA/SCL, so using I2C eliminates the last analog inputs)

This leaves a Uno with 6 digital pins and either 2 analog pins OR one I2C bus — insufficient for most projects that combine a display with sensors, actuators, or communication modules.

The Mega 2560, with 54 digital I/O and 16 analog inputs, absorbs the shield's pin consumption while retaining substantial free I/O. The shield plugs into the Mega's compatible headers, and the SPI bus on the Mega uses the ICSP header (same as Uno), so no code changes are needed for the display. The Mega's additional pins make it the natural host for any project that needs this TFT shield plus anything else.

This is distinct from all-in-one boards (like M5Stack or PyGamer) that integrate displays with limited GPIO by design. A shield is removable — the Uno gets its pins back when the shield is removed. But while mounted, the effect is the same: GPIO starvation.

---

Source: [[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]]

Relevant Notes:
- [[resistive-touch-consumes-analog-pins-creating-a-hidden-resource-conflict-with-analog-sensors]] — the analog pin dimension of this problem
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] — SPI pin differences on Mega, though the ICSP header is shared

Topics:
- [[displays]]
- [[shields]]
- [[microcontrollers]]
