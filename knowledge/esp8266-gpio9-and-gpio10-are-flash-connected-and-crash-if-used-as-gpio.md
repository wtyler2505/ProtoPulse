---
description: "GPIO9 (SD2) and GPIO10 (SD3) are wired to the SPI flash chip on the ESP-12E module -- using them as GPIO corrupts flash or crashes the chip immediately"
type: claim
source: "docs/parts/esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp8266-nodemcu-amica"
---

# ESP8266 GPIO9 and GPIO10 are connected to flash and will crash the chip if used as GPIO

GPIO9 (also labeled D9 or SD2) and GPIO10 (D10 or SD3) are physically connected to the data lines of the SPI flash chip on the ESP-12E module. The ESP8266 uses SPI to access its program flash, and these two pins carry the QSPI data signals (DIO2 and DIO3 in quad-SPI mode).

Attempting to configure or drive these pins as regular GPIO has immediate consequences:
- **Flash corruption** — writing to a flash data line can flip bits in the stored program or filesystem
- **Immediate crash** — reading from flash becomes corrupted mid-instruction, causing an exception
- **Bus contention** — the flash chip and your peripheral both driving the same wire creates electrical conflicts

Most NodeMCU boards do not break out GPIO9/10 on their pin headers, which prevents accidental use. However, some bare ESP-12E modules or alternative breakout boards expose all pins including these. If your board shows SD2/SD3 or GPIO9/GPIO10 on accessible headers, treat them as permanently unavailable.

**Comparison with ESP32:** The ESP32 has 6 flash-connected pins (GPIO6-11) that are similarly off-limits. The pattern is identical — SPI flash occupies pins that appear in the GPIO numbering but are physically committed to the flash interface. In both cases, the flash-connected pins should be treated as if they do not exist.

**ProtoPulse implication:** The breadboard bench coach should never route signals to GPIO9/10 and should display them as "FLASH — DO NOT USE" in any pin diagram or auto-routing context.

---

Relevant Notes:
- [[esp32-six-flash-gpios-must-never-be-used]] — same pattern on ESP32 with 6 pins (GPIO6-11) instead of 2
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]] — GPIO9/10 are not even counted in the 11 usable pins; they are completely invisible to the user

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
