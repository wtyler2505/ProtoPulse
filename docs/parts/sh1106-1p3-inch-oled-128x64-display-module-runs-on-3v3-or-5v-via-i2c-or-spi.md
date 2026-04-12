---
description: "Best small high-contrast display for microcontroller projects — 128x64 pixels, SH1106 driver, works with Adafruit_SSD1306 library (SH1106 fork)"
topics: ["[[displays]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [I2C, SPI]
logic_level: "mixed"
logic_notes: "Most modules accept 3.3V or 5V VCC and bring I2C/SPI logic into the module's own supply domain, but exact pull-ups and regulator choices vary by board."
manufacturer: "Generic"
pinout: |
  GND → GND
  VCC → 3.3V or 5V
  SCL → I2C clock (GPIO22 on ESP32, A5 on Arduino)
  SDA → I2C data (GPIO21 on ESP32, A4 on Arduino)
i2c_address: "0x3C"
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["Some modules are 3.3V only — check your specific board before connecting to 5V"]
datasheet_url: ""
---

# SH1106 1.3-inch OLED 128x64 Display Module

High-contrast monochrome OLED with the SH1106 driver IC. The SH1106 is nearly identical to the SSD1306 but has a 132x64 internal buffer (only 128x64 visible), which means you need an SH1106-aware library or fork. Most cheap 1.3" OLEDs use SH1106; most 0.96" OLEDs use SSD1306. If `Adafruit_SSD1306` shows garbled output or a 2-pixel offset, you have an SH1106.

## Specifications

| Spec | Value |
|------|-------|
| Display type | OLED (organic LED, self-emitting) |
| Driver IC | SH1106 |
| Resolution | 128 x 64 pixels |
| Screen size | 1.3 inches diagonal |
| Color | Monochrome (white, blue, or yellow/blue variants) |
| Operating voltage | 3.3V - 5V (module has onboard regulator) |
| Logic level | 3.3V |
| Interface | I2C (default) or SPI (board-dependent) |
| I2C address | 0x3C (some boards: 0x3D, check solder jumper) |
| I2C speed | Up to 400kHz |
| Viewing angle | >160 degrees |
| Operating temp | -40C to +85C |
| Current draw | ~20mA typical at 50% pixel fill |
| Internal buffer | 132 x 64 (only 128x64 visible — 2px offset each side) |

## Pinout

```
I2C Module (4-pin):
  GND → GND
  VCC → 3.3V or 5V
  SCL → I2C clock (GPIO22 on ESP32, A5 on Arduino Uno)
  SDA → I2C data (GPIO21 on ESP32, A4 on Arduino Uno)

SPI Module (7-pin):
  GND → GND
  VCC → 3.3V or 5V
  D0  → SPI clock (SCK)
  D1  → SPI data (MOSI)
  RES → Reset (any digital pin)
  DC  → Data/Command select (any digital pin)
  CS  → Chip select (any digital pin)
```

## Wiring Notes

**I2C mode (most common, 4-pin module):**
- Only needs 2 data wires plus power — dead simple
- Default address 0x3C; if you have two OLEDs, set one to 0x3D via the address solder jumper on the back
- I2C pull-ups are usually onboard; don't add external pull-ups unless the bus is long (>30cm)

**SPI mode (7-pin module):**
- Faster refresh than I2C but uses 5 pins instead of 2
- Use SPI when you need higher frame rates or the I2C bus is already congested

**SH1106 vs SSD1306 — the gotcha:**
- The SH1106 has a 132-column buffer but only displays 128 columns, creating a 2-pixel horizontal offset
- Standard `Adafruit_SSD1306` will show content shifted or garbled — use the `Adafruit_SH1106` fork or `U8g2` library with `U8G2_SH1106_128X64_NONAME_F_HW_I2C`
- `U8g2` handles both SH1106 and SSD1306 transparently — best choice if you're not sure which driver you have

**Library options:**
- `U8g2` (recommended) — handles SH1106/SSD1306 with proper constructors
- `Adafruit_SH1106` — fork of Adafruit_SSD1306, drop-in replacement
- `SH1106Wire` — lightweight ESP8266/ESP32 option

**Power:**
- Module onboard regulator typically accepts 3.3V-5V on VCC
- Logic pins are 3.3V — safe for ESP32 direct connection
- On 5V boards (Arduino Uno/Mega), the module's onboard level shifting handles it, but verify your specific board

## Related Parts

- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] — alternative text-only display, higher power but cheaper
- [[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]] — alternative for simple graphics/scrolling text

---

Categories:
- [[displays]]
