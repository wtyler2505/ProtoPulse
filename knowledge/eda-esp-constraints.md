---
description: "ESP32 and ESP8266 constraints, strapping pins, and power budgets"
type: moc
topics:
  - "[[eda-fundamentals]]"
---

# eda-esp-constraints

ESP32 and ESP8266 specific constraints, boot strapping pins, peripheral conflicts, and power budgets.

## Notes
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- strapping pin sets flash voltage, HIGH = brown-out
- [[esp32-adc2-unavailable-when-wifi-active]] -- ADC2 shares hardware with WiFi radio, no arbitration
- [[esp32-six-flash-gpios-must-never-be-used]] -- GPIO 6-11 are internal flash bus, always restricted
- [[esp32-i2c-is-software-implemented-and-remappable-to-any-gpio-pair]] -- software I2C remappable to any GPIO, unlike AVR
- [[vspi-is-the-safest-esp32-spi-bus-because-hspi-pins-have-boot-restrictions]] -- VSPI (GPIO18/19/23/5) has no boot conflicts
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- ADC nonlinearity above 2.5V requires calibration
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] -- 4 attenuation levels from 0dB/1.1V to 11dB/3.3V
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] -- AMS1117 thermal budget limits board current
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] -- 10uA deep sleep for battery IoT
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] -- only 14 unrestricted GPIOs out of 34
- [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] -- input-only pins need external pull resistors
- [[esp32-dac-on-gpio25-26-provides-true-8bit-analog-output]] -- true analog output, rare among maker MCUs
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]] -- 5 safe GPIOs out of 11 total
- [[esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on]] -- 3 boot strapping pins
- [[esp8266-a0-analog-input-has-0-1v-range-not-0-3v3]] -- 0-1V ADC range, not 0-3.3V
- [[esp8266-gpio16-is-architecturally-unique-and-cannot-do-pwm-or-i2c]] -- GPIO16 on separate RTC domain
- [[esp8266-pwm-is-software-implemented-at-1khz-unsuitable-for-servo-control]] -- 1kHz software PWM inadequate for servos
- [[esp8266-gpio9-and-gpio10-are-flash-connected-and-crash-if-used-as-gpio]] -- flash-connected, unusable
- [[esp8266-wifi-consumes-50kb-ram-leaving-only-30kb-for-user-code]] -- WiFi stack dominates 80KB SRAM
- [[i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently]] -- I2C pull-ups on boot pins prevent boot
