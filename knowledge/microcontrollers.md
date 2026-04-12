---
description: "Microcontroller knowledge -- specs, GPIO gotchas, peripheral mapping, clone differences, and selection criteria for Arduino, ESP32, RPi, and others"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# microcontrollers

Specs, gotchas, and selection criteria for microcontrollers and single-board computers in the inventory. Covers pin mapping, voltage levels, peripheral availability, clone compatibility, and platform-specific traps.

## Knowledge Notes
- [[most-maker-displays-accept-3v3-5v-but-character-lcds-and-7-segments-are-5v-only-gotchas]] — 5V display gotchas for 3.3V MCU users (ESP32, Pi Pico)
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] — #1 Uno-to-Mega porting gotcha, silent SPI failure
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] — linear regulator heat limits practical Vin to 7-9V
- [[mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules]] — 3.3V pin too weak for ESP/BT modules
- [[esp32-i2c-is-software-implemented-and-remappable-to-any-gpio-pair]] — I2C on any pin pair, not hardware-bound like AVR
- [[vspi-is-the-safest-esp32-spi-bus-because-hspi-pins-have-boot-restrictions]] — HSPI GPIO12/15 are boot-sensitive; use VSPI first
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] — 12-bit ADC accuracy degrades at upper voltage range
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] — 4 attenuation levels trade range for resolution
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] — WiFi draws 240mA peak, leaving ~560mA headroom
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] — 10uA sleep enables months on coin cell
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] — only 14 of 34 GPIOs are unrestricted
- [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] — 4 pins lack output driver and pull resistors
- [[esp32-dac-on-gpio25-26-provides-true-8bit-analog-output]] — rare true DAC among maker MCUs

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
