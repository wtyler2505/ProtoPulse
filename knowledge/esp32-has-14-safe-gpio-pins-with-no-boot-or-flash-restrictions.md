---
description: "GPIO 4, 5, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33 are the only pins free of boot strapping and flash conflicts -- 14 out of 34 total"
type: claim
source: "docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[breadboard-intelligence]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# ESP32 has 14 safe general-purpose GPIO pins with no boot or flash restrictions

Out of the ESP32's 34 GPIO pins, only 14 are truly "safe" for general-purpose use without worrying about boot behavior, flash conflicts, or input-only limitations: GPIO 4, 5, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, and 33.

The remaining 20 pins are restricted in various ways:
- **GPIO 6-11** (6 pins): hardwired to internal SPI flash, completely unusable
- **GPIO 0, 2, 12, 15** (4 pins): boot strapping pins that must be in specific states during power-on
- **GPIO 34, 35, 36, 39** (4 pins): input-only with no internal pull resistors
- **GPIO 1, 3** (2 pins): UART0 TX/RX, used for USB-serial communication and boot messages
- **GPIO 13, 14** (2 pins): HSPI bus with GPIO12/15 boot dependencies
- **GPIO 25, 26** (included in safe list but shared with DAC and ADC2)

Beginners should design exclusively around the 14 safe pins first, only reaching into the restricted pins when they understand the specific constraints. This is a fundamentally different model from Arduino boards where nearly all digital pins are interchangeable.

**ProtoPulse implication:** The bench coach and schematic editor should visually distinguish safe vs restricted pins. When auto-routing wires, the algorithm should prefer the 14 safe pins and only use restricted pins with explicit warnings. The breadboard view should color-code pins by restriction level (green=safe, yellow=boot-sensitive, red=flash/input-only).

---

Relevant Notes:
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- one of the 4 boot strapping pins that restricts the usable pin count
- [[esp32-six-flash-gpios-must-never-be-used]] -- 6 of the 20 restricted pins are completely off-limits
- [[esp32-adc2-unavailable-when-wifi-active]] -- even some "safe" pins (GPIO4, 25, 26, 27) lose ADC capability with WiFi
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- Arduino pin restrictions are simpler but still trip people up

Topics:
- [[microcontrollers]]
- [[breadboard-intelligence]]
- [[eda-fundamentals]]
