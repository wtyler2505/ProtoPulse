---
description: "A 4x4 matrix keypad requires 8 GPIO pins (4 rows + 4 columns), consuming 57% of Uno's digital I/O or 73% of ESP8266's safe pins — on pin-constrained platforms, a PCF8574 I2C I/O expander reduces this to 2 pins (SDA + SCL)"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[membrane-switch-keypad-module-tactile-button-array]]"
---

# 4x4 matrix keypad consumes 8 GPIO pins making I/O expander mandatory on pin-constrained MCUs

The GPIO budget impact of matrix keypads:

| Layout | Pins Required | On Uno (14 digital) | On ESP8266 (5 safe) | On Mega (54 I/O) |
|--------|--------------|---------------------|---------------------|------------------|
| 4x3 | 7 pins | 50% budget | Impossible | 13% budget |
| 4x4 | 8 pins | 57% budget | Impossible | 15% budget |

The architectural decision tree:
- **Pin-rich MCU (Mega, ESP32, Pico):** Direct GPIO connection is fine. 8 pins out of 26-54 is manageable.
- **Pin-constrained MCU (Uno, Nano):** Feasible but leaves little room for other peripherals. Consider impact on remaining pin budget.
- **Severely constrained (ESP8266):** A PCF8574 I2C I/O expander is mandatory. 8 I/O pins over I2C (SDA + SCL = 2 MCU pins).

The PCF8574 approach trades pin count for complexity:
- 2 pins instead of 8 (I2C bus, shareable with other devices)
- Adds I2C address management
- Adds library dependency (I2CKeypad or similar)
- Slightly slower scan rate (I2C overhead vs direct GPIO)

Alternatively, the 74HC165 (parallel-to-serial shift register, the input cousin of the 74HC595) can read 8 inputs over 3 SPI-like pins — though the PCF8574 is more common for keypad applications.

---

Topics:
- [[input-devices]]

Related:
- [[matrix-keypad-scanning-drives-one-row-low-at-a-time-and-reads-columns-with-pull-ups-to-detect-key-position]]
- [[74hc595-trades-3-gpio-pins-for-n-times-8-digital-outputs-via-serial-shift-and-parallel-latch]]
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]]
- [[pcf8574-i2c-backpack-defaults-to-address-0x27-but-pcf8574a-variant-defaults-to-0x3f-and-solder-jumpers-allow-8-addresses-per-chip]]
