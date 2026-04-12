---
description: "Display selection is a dependency chain: display type -> interface protocol (I2C/SPI/parallel) -> driver IC -> Arduino library -> pin count. Each decision constrains the next."
type: knowledge-note
source: "docs/parts/displays.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# display type determines interface protocol and driver IC which together set library and pin count

Choosing a display for a microcontroller project is a dependency chain, not a feature comparison. The display type constrains everything downstream:

**The dependency chain:**
1. **Display type** (OLED, TFT, character LCD, 7-segment, LED matrix) -- determined by what you need to show
2. **Interface protocol** (I2C, SPI, parallel, direct digital) -- determined by display type and driver IC
3. **Driver IC** (SSD1306, ILI9341, HD44780, MAX7219, none) -- determined by display type
4. **Arduino library** -- determined by driver IC
5. **Pin count** -- determined by interface protocol

**Concrete examples from the inventory:**

| Display | Interface | Pins Needed | Driver | Library | Tradeoff |
|---------|-----------|-------------|--------|---------|----------|
| SH1106 OLED 128x64 | I2C | 4 (SDA, SCL, VCC, GND) | SSD1306-compatible | Adafruit_SSD1306 | Fewest pins, slowest refresh |
| ILI9341 TFT 320x240 | SPI | 9+ display (MOSI, MISO, SCK, CS, DC, RST) + 4 touch (A0-A3 for resistive) = 13+ total | ILI9341 | Adafruit_ILI9341 + Adafruit_TouchScreen | Most pins, fastest for color graphics; touch adds analog pin cost |
| HD44780 16x2 LCD | Parallel or I2C | 6 (4-bit parallel: RS, E, D4-D7) or 4 (I2C backpack: SDA, SCL, VCC, GND) | HD44780 | LiquidCrystal / LiquidCrystal_I2C | I2C backpack reduces 6 data pins to 2; 4-bit mode sends nibbles |
| 7-segment (single digit) | Direct GPIO | 10 (7 segments + DP + common) | None | Manual multiplex | No driver IC = you handle multiplexing |
| 8x8 LED matrix | SPI | 5 | MAX7219 | LedControl | MAX7219 cascades for larger displays |

**Why this matters for beginners:** A beginner might choose a TFT because "it looks better" without realizing it needs 9+ pins and an SPI bus, which may conflict with other SPI devices (SD card, MAX7219). Or they choose a parallel LCD consuming 16 GPIO pins when an I2C OLED uses 4. The AI bench coach should surface these tradeoffs when a display is added to the schematic.

**Real-world SPI bus contention example:** The Adafruit PyGamer's ST7735R TFT display and microSD card slot share the same SPI bus. Both use SPI with separate chip-select lines, so they can't communicate simultaneously. If the display is refreshing and the SD card tries to read, one must wait. This is a concrete case of bus contention on a single commercial board -- not a theoretical warning, but a design constraint users will hit when trying to load game assets from SD while drawing to the screen.

---

Topics:
- [[displays]]
- [[eda-fundamentals]]
