---
description: "2.8-inch color TFT LCD with resistive touchscreen — ILI9341 driver, 320x240 pixels, Arduino shield form factor, SPI interface"
topics: ["[[displays]]", "[[shields]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [SPI, GPIO]
logic_level: "mixed"
logic_notes: "The ILI9341 controller is a 3.3V device, but this Arduino shield includes onboard level shifting and routing specifically for 5V Uno/Mega compatibility."
manufacturer: "Generic"
part_number: "TFT-2.8-ILI9341"
pinout: |
  Shield form factor — plugs directly into Arduino Uno/Mega headers
  Uses SPI for display data
  Touch uses analog pins for resistive touch reading
  D10 → TFT CS
  D9  → TFT DC
  D8  → TFT Reset (some variants)
  ICSP → SPI (MOSI, MISO, SCK)
  A0-A3 → Resistive touch (XP, XM, YP, YM)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]"]
used_in: []
warnings: ["Occupies most Arduino Uno pins when mounted as shield — limited remaining I/O", "ILI9341 logic is 3.3V — shield has onboard level shifting for 5V Arduino compatibility", "Resistive touch requires calibration — run a calibration sketch to get correct coordinate mapping", "SPI bus is shared — if using with SD card or other SPI devices, manage CS pins carefully"]
datasheet_url: "https://cdn-shop.adafruit.com/datasheets/ILI9341.pdf"
---

# 2.8-inch TFT LCD Touch Shield — ILI9341 320x240 SPI

A color graphical display with touchscreen input in Arduino shield form factor. The ILI9341 driver gives you 320x240 pixels at 262K colors over SPI. The resistive touchscreen adds basic touch input — not as smooth as capacitive, but it works and doesn't need a separate touch controller IC.

## Specifications

| Spec | Value |
|------|-------|
| Screen Size | 2.8 inches diagonal |
| Resolution | 320 x 240 pixels (QVGA) |
| Color Depth | 262K (18-bit) |
| Driver IC | ILI9341 |
| Interface | SPI |
| Touch | 4-wire resistive |
| Form Factor | Arduino Uno/Mega shield |
| Backlight | LED (always on) |

## Libraries

- **Display:** `Adafruit_ILI9341` + `Adafruit_GFX`
- **Touch:** `Adafruit_TouchScreen` or `XPT2046_Touchscreen` (depends on variant)

```cpp
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
Adafruit_ILI9341 tft(10, 9); // CS, DC
```

---

Related Parts:
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] — smaller, simpler monochrome alternative
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] — text-only but much simpler to drive
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — best host board, Uno runs low on pins with this shield
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — shield plugs directly in, but consumes most I/O pins leaving few for sensors
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same compatibility as genuine Mega
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] — Uno clone, shield fits but same pin limitation as genuine Uno

Categories:
- [[displays]]
- [[shields]]
