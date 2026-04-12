---
description: "ESP32 exposes 3 SPI buses -- one reserved for flash (GPIO6-11), HSPI on GPIO12-15 (boot-sensitive), and VSPI on GPIO18/19/23/5 with zero conflicts"
type: claim
source: "docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# VSPI is the safest SPI bus on ESP32 because HSPI pins have boot restrictions

The ESP32 has three SPI peripherals. The first (SPI) is permanently reserved for internal flash (GPIO6-11) and must never be touched. The remaining two -- HSPI and VSPI -- are available for user peripherals, but they are not equally safe.

HSPI uses GPIO12 (MISO), GPIO13 (MOSI), GPIO14 (SCK), and GPIO15 (SS). GPIO12 is a boot strapping pin that must be LOW at power-on or the module crashes. GPIO15 is another strapping pin that controls boot message output. Connecting SPI peripherals to these pins means whatever state the peripheral holds during the boot window can prevent the ESP32 from starting.

VSPI uses GPIO19 (MISO), GPIO23 (MOSI), GPIO18 (SCK), and GPIO5 (SS). All four of these are "safe general-purpose" pins with no boot restrictions and no flash conflicts. VSPI is the clear default choice for any SPI peripheral.

**When to use HSPI:** Only when VSPI is already occupied by another SPI device and you need a second bus. In that case, add a strong pull-down on GPIO12 (4.7k to GND) and ensure GPIO15 has a pull-up. Or remap the HSPI pins to other GPIOs using the ESP-IDF SPI driver (HSPI is also software-configurable, unlike on AVR boards).

---

Relevant Notes:
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- GPIO12 is HSPI MISO, making HSPI inherently boot-risky
- [[esp32-six-flash-gpios-must-never-be-used]] -- the first SPI bus is off-limits, leaving only HSPI and VSPI
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- Mega has its own SPI porting trap; ESP32's multiple buses add a different dimension of complexity

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
