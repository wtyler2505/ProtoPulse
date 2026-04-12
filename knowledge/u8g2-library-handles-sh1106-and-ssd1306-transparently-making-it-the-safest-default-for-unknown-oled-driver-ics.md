---
description: "U8g2 abstracts away SH1106/SSD1306 buffer differences through explicit constructor selection — for beginners unsure which driver IC their OLED uses, U8g2 is the safest library choice because switching between drivers only requires changing the constructor, not the drawing code"
type: claim
source: "docs/parts/sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
---

# u8g2 library handles sh1106 and ssd1306 transparently making it the safest default for unknown oled driver ics

The U8g2 library handles the SH1106 vs SSD1306 difference through constructor selection rather than library replacement. The API and drawing code remain identical — only the constructor line changes:

```cpp
// For SSD1306 (0.96" modules typically):
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0);

// For SH1106 (1.3" modules typically):
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0);
```

All drawing calls (`drawStr`, `drawLine`, `drawBitmap`, etc.) work identically with either constructor. The SH1106 constructor internally applies the 2-pixel column offset so the user never has to think about it. This means diagnosing an unknown OLED is a one-line change: swap the constructor, recompile, see if the display renders correctly.

**Comparison with alternatives:**
- **Adafruit_SSD1306** — only works correctly with SSD1306. Garbled output on SH1106.
- **Adafruit_SH1106** — a community fork of Adafruit_SSD1306 for SH1106. Different library to install, different include, but same Adafruit_GFX drawing API.
- **SH1106Wire** — lightweight ESP8266/ESP32 option for SH1106 only. Not portable to AVR.
- **U8g2** — handles both drivers, plus dozens of other display controllers (ST7920, UC1701, etc.). Heavier memory footprint than Adafruit libraries (~5-10KB more on AVR), but the universality is worth it for projects where the display might change.

**When NOT to use U8g2:** On AVR boards with tight flash (ATmega328P at 32KB), U8g2's larger footprint can push a complex project over the limit. In that case, use the correct Adafruit library (SSD1306 or SH1106 fork) to save flash. But for ESP32, SAMD, RP2040, or any 32-bit board, the flash overhead is negligible.

**ProtoPulse implication:** The bench coach library recommendation should default to U8g2 for OLED displays unless the user has explicitly identified their driver IC. If they know it is SSD1306, Adafruit_SSD1306 is lighter. If they know it is SH1106, Adafruit_SH1106 works. If they are unsure, U8g2 is the safe path.

---

Source: [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]

Relevant Notes:
- [[sh1106-132-column-buffer-with-only-128-visible-creates-a-2-pixel-offset-that-causes-garbled-display-with-ssd1306-libraries]] — the problem U8g2 solves
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — library selection is step 4 in the dependency chain

Topics:
- [[displays]]
