---
description: "A practical heuristic: cheap 1.3-inch 128x64 OLEDs almost always use the SH1106 driver, while 0.96-inch 128x64 OLEDs almost always use SSD1306 — knowing this before coding prevents the most common OLED library mismatch"
type: claim
source: "docs/parts/sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
---

# oled screen size predicts driver ic where 1.3-inch modules use sh1106 and 0.96-inch use ssd1306

In the generic OLED module market, screen diagonal size is a reliable first-pass predictor of which driver IC is on the board:

| Screen Size | Typical Driver | Buffer | Library |
|-------------|---------------|--------|---------|
| 0.96 inch | SSD1306 | 128x64 (1:1 mapping) | Adafruit_SSD1306, U8g2 |
| 1.3 inch | SH1106 | 132x64 (2px offset) | U8g2, Adafruit_SH1106 |

This heuristic is not absolute — some 1.3" modules use SSD1306, and some 0.96" modules use SH1106 — but it holds for the vast majority of cheap modules sold on AliExpress, Amazon, and eBay. The module silkscreen rarely identifies the driver IC, so this size-based heuristic is the fastest way to make an educated guess before writing code.

**Why this matters for beginners:** A beginner buying "a 128x64 OLED" sees identical-looking modules at 0.96" and 1.3" sizes and naturally picks the larger one for better visibility. Every OLED tutorial they find uses `Adafruit_SSD1306`. The larger module uses SH1106, the tutorial library produces garbled output, and the beginner thinks they have a defective module or a wiring error. Knowing the size-to-driver heuristic short-circuits this entire debugging loop.

**Verification method:** If unsure, use U8g2 and try both constructors — the wrong one will produce obviously broken output (garbled, offset, or blank), while the correct one will render cleanly. Alternatively, some modules have the driver IC printed on the flex cable connecting the OLED panel to the PCB, visible under magnification.

---

Source: [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]

Relevant Notes:
- [[sh1106-132-column-buffer-with-only-128-visible-creates-a-2-pixel-offset-that-causes-garbled-display-with-ssd1306-libraries]] — the specific failure caused by driver IC mismatch
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — driver IC identification is step 3 in the dependency chain

Topics:
- [[displays]]
