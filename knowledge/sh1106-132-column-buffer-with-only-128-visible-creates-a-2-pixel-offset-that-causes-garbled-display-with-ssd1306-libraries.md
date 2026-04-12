---
description: "The SH1106 OLED driver has a 132x64 internal framebuffer but only 128x64 pixels are visible, so libraries addressing columns 0-127 hit columns 2-129 on the display — causing shifted or garbled output that looks like a hardware fault but is a software mismatch"
type: claim
source: "docs/parts/sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
---

# sh1106 132-column buffer with only 128 visible creates a 2-pixel offset that causes garbled display with ssd1306 libraries

The SH1106 OLED driver IC has a 132-column internal framebuffer, but only 128 columns are physically connected to the display panel. The visible window starts at column 2 and ends at column 129, leaving 2 invisible columns on each side. The SSD1306, by contrast, has a 128-column buffer that maps 1:1 to the 128-column display.

When the standard `Adafruit_SSD1306` library addresses an SH1106 display, it writes pixel data starting at column 0. But on the SH1106, column 0 is in the invisible region — so the image appears shifted right by 2 pixels, with the rightmost 2 columns of intended content wrapping into the invisible left edge. On a 128x64 monochrome display, this manifests as content that looks garbled, shifted, or partially cut off.

**The diagnostic:** If `Adafruit_SSD1306` produces shifted or garbled output on an OLED that looks physically identical to one that works, the module almost certainly uses an SH1106 driver instead of SSD1306. This is the single most common SH1106 failure mode.

**The fix options:**
1. **U8g2 library** (recommended) — use the `U8G2_SH1106_128X64_NONAME_F_HW_I2C` constructor, which handles the column offset internally
2. **Adafruit_SH1106 fork** — drop-in replacement for Adafruit_SSD1306 with the offset correction
3. **SH1106Wire** — lightweight option for ESP8266/ESP32

**Why this trap is so common:** Most beginner OLED tutorials use `Adafruit_SSD1306` because the SSD1306 was the first popular OLED driver. When a beginner buys a "128x64 OLED" without checking the driver IC, they follow the SSD1306 tutorial, and it almost works — the shifted/garbled output looks like a wiring error, not a library mismatch. The module silkscreen often says neither "SH1106" nor "SSD1306," compounding the confusion.

This pattern is structurally identical to [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]] — a silicon swap that the module does not advertise, causing a library-level failure that looks like a hardware problem.

---

Source: [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]

Relevant Notes:
- [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]] — same "invisible chip swap" pattern
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — driver IC determines library, and getting the IC wrong breaks the chain
- [[u8g2-library-handles-sh1106-and-ssd1306-transparently-making-it-the-safest-default-for-unknown-oled-driver-ics]] — the practical fix

Topics:
- [[displays]]
