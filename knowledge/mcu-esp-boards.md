---
description: "ESP32 and ESP8266 WiFi microcontrollers, strapping pins, and power management"
type: moc
topics:
  - "[[microcontrollers]]"
---

# mcu-esp-boards

ESP32 and ESP8266 (NodeMCU) gotchas, boot strapping pins, sleep modes, and peripheral restrictions.

## Notes
### ESP32
- [[esp32-i2c-is-software-implemented-and-remappable-to-any-gpio-pair]] — I2C on any pin pair, not hardware-bound like AVR
- [[vspi-is-the-safest-esp32-spi-bus-because-hspi-pins-have-boot-restrictions]] — HSPI GPIO12/15 are boot-sensitive; use VSPI first
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] — 12-bit ADC accuracy degrades at upper voltage range
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] — 4 attenuation levels trade range for resolution
- [[esp32-adc2-unavailable-when-wifi-active]] — WiFi claims ADC2, silently breaking pins GPIO0/2/4/12-15/25-27 for analog
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] — WiFi draws 240mA peak, leaving ~560mA headroom
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] — 10uA sleep enables months on coin cell
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] — only 14 of 34 GPIOs are unrestricted
- [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] — 4 pins lack output driver and pull resistors
- [[esp32-gpio5-is-a-strapping-pin-for-boot-message-printing-and-should-not-be-treated-as-unconditionally-safe]] — GPIO5 is a strapping pin; pull state at boot affects debug output
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] — GPIO12 MTDI strapping pin selects flash voltage; HIGH at boot = crash
- [[esp32-six-flash-gpios-must-never-be-used]] — GPIO6-11 wired to SPI flash; touching them = reset/corruption
- [[esp32-dac-on-gpio25-26-provides-true-8bit-analog-output]] — rare true DAC among maker MCUs
- [[esp32-gpio25-26-are-both-dac-outputs-and-recommended-i2s-pins-creating-peripheral-exclusion]] — DAC vs I2S peripheral conflict on same pins
- [[esp32-replaces-tone-with-ledcwritetone-and-the-api-is-not-a-drop-in-substitution]] — Arduino tone() library absent; ledcWriteTone() requires channel setup
- [[esp32-38pin-barely-fits-breadboard-with-one-free-column]] — 38-pin DevKitC leaves one breadboard column free per side
- [[esp32-4wd-rover-consumes-20-of-34-gpios-for-motor-control-forcing-use-of-strapping-and-input-only-pins]] — real-world 4-motor project overruns safe GPIO pool

### ESP8266 / NodeMCU
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]] — only 5 unrestricted GPIOs out of 11
- [[esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on]] — 3 boot strapping pins with strict requirements
- [[esp8266-a0-analog-input-has-0-1v-range-not-0-3v3]] — ADC input range is 0-1V, not 0-3.3V
- [[esp8266-gpio16-is-architecturally-unique-and-cannot-do-pwm-or-i2c]] — GPIO16 on separate RTC domain
- [[esp8266-deep-sleep-requires-physical-wire-from-gpio16-to-rst]] — deep sleep wake needs GPIO16-RST bridge
- [[nodemcu-board-draws-8-20ma-in-deep-sleep-defeating-chip-level-20ua-spec]] — dev board quiescent defeats chip sleep current
- [[esp8266-pwm-is-software-implemented-at-1khz-unsuitable-for-servo-control]] — software PWM too slow for servos
- [[esp8266-gpio9-and-gpio10-are-flash-connected-and-crash-if-used-as-gpio]] — GPIO9/10 connected to internal flash
- [[esp8266-wifi-consumes-50kb-ram-leaving-only-30kb-for-user-code]] — WiFi stack takes most of 80KB SRAM
- [[esp8266-i2s-is-receive-only-with-fixed-pins-and-a-boot-pin-conflict-on-gpio2]] — I2S hardware is RX-only and steps on GPIO2 boot pin
- [[i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently]] — I2C pull-ups on boot pins block boot
- [[nodemcu-amica-23mm-spacing-fits-standard-breadboard-with-both-rails-accessible]] — NodeMCU Amica breadboard friendly
- [[breadboard-bench-coach-should-flag-i2c-on-esp8266-boot-pins-as-wiring-error]] — DRC should catch I2C on boot pins
