---
description: "GPIO0 must be HIGH (LOW=flash mode), GPIO2 must be HIGH (internal pull-up), GPIO15 must be LOW (external pull-down) -- wrong states at reset cause silent boot failure"
type: claim
source: "docs/parts/esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[breadboard-intelligence]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp8266-nodemcu-amica"
---

# ESP8266 boot pins GPIO0 GPIO2 and GPIO15 must be in specific states at power-on or the board fails to start

The ESP8266 samples three GPIO pins during power-on reset to determine boot mode. If any of these pins are held in the wrong state by a connected peripheral, the board either enters flash/upload mode instead of running user code, or fails to boot entirely — with no error message, just silence.

| Pin | D-label | Required at Boot | What Happens if Wrong |
|-----|---------|-----------------|----------------------|
| GPIO0 | D3 | **HIGH** | LOW enters download/flash mode — the FLASH button does this intentionally |
| GPIO2 | D4 | **HIGH** (internal pull-up) | LOW prevents boot; the onboard LED is on this pin (active LOW) |
| GPIO15 | D8 | **LOW** (external pull-down on most boards) | HIGH prevents boot; SPI CS default |

The failure mode is insidious because these pins work perfectly as GPIO after boot. You can use them for output, SPI, even PWM — the restriction only applies during the brief power-on window. This means a circuit that worked fine while you were iterating (with the ESP already running) suddenly fails when you power-cycle — because the peripheral you wired is now holding a boot pin in the wrong state during the reset sequence.

**Common traps:**
- I2C devices on D3/D4 that idle with SDA/SCL LOW during their own startup
- SPI peripherals on D8 that drive CS HIGH when not selected
- Pull-up resistors on D8 (GPIO15) for any reason
- LED circuits on D4 (GPIO2) that pull the pin LOW through a current-limiting resistor
- I2S microphones using GPIO2 as WS (word select / LRCLK) — if the I2S driver hasn't initialized yet, WS may idle LOW, violating the boot requirement. Add a 10k pull-up on GPIO2 and initialize I2S only after boot completes

**Safe pattern:** Reserve D3, D4, and D8 for outputs only, verify they meet boot requirements with no load, and use D1/D2 for I2C instead. SPI on D5-D8 is generally safe because D8 (CS) has an external pull-down that satisfies boot, and the other SPI pins (D5/D6/D7) have no boot restrictions.

---

Relevant Notes:
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] — ESP32's equivalent boot pin trap, but GPIO12 selects flash voltage (more dangerous) while ESP8266 GPIO0/2/15 select boot mode
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]] — boot pin restrictions are the primary reason only 5 of 11 pins are truly safe
- [[i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently]] — the specific failure mode when peripherals hold boot pins wrong

Topics:
- [[microcontrollers]]
- [[breadboard-intelligence]]
- [[eda-fundamentals]]
