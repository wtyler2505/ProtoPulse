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
- [[uno-single-uart-shared-with-usb-forces-choose-one-between-debugging-and-peripherals]] — #1 Uno beginner wall: can't debug while serial peripheral connected
- [[uno-20ma-per-pin-200ma-total-means-no-direct-led-or-motor-drive]] — ATmega328P GPIO current limits, no direct motor drive
- [[uno-i2c-on-a4-a5-consumes-one-third-of-analog-inputs]] — I2C locks out 2 of 6 analog channels
- [[uno-only-2-external-interrupts-on-d2-d3-is-a-hard-project-sizing-constraint]] — 2 interrupts limit project complexity
- [[uno-defines-the-standard-arduino-shield-header-layout]] — Uno IS the reference form factor for shields
- [[uno-d10-must-stay-output-for-hardware-spi-master-mode]] — D10 INPUT causes silent SPI master-to-slave switch
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]] — only 5 unrestricted GPIOs out of 11
- [[esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on]] — 3 boot strapping pins with strict requirements
- [[esp8266-a0-analog-input-has-0-1v-range-not-0-3v3]] — ADC input range is 0-1V, not 0-3.3V
- [[esp8266-gpio16-is-architecturally-unique-and-cannot-do-pwm-or-i2c]] — GPIO16 on separate RTC domain
- [[esp8266-deep-sleep-requires-physical-wire-from-gpio16-to-rst]] — deep sleep wake needs GPIO16-RST bridge
- [[nodemcu-board-draws-8-20ma-in-deep-sleep-defeating-chip-level-20ua-spec]] — dev board quiescent defeats chip sleep current
- [[esp8266-pwm-is-software-implemented-at-1khz-unsuitable-for-servo-control]] — software PWM too slow for servos
- [[esp8266-gpio9-and-gpio10-are-flash-connected-and-crash-if-used-as-gpio]] — GPIO9/10 connected to internal flash
- [[esp8266-wifi-consumes-50kb-ram-leaving-only-30kb-for-user-code]] — WiFi stack takes most of 80KB SRAM
- [[i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently]] — I2C pull-ups on boot pins block boot
- [[nodemcu-amica-23mm-spacing-fits-standard-breadboard-with-both-rails-accessible]] — NodeMCU Amica breadboard friendly
- [[breadboard-bench-coach-should-flag-i2c-on-esp8266-boot-pins-as-wiring-error]] — DRC should catch I2C on boot pins
- [[rp2040-pio-state-machines-implement-custom-protocols-at-hardware-speed]] — PIO implements custom protocols in hardware, unique to RP2040
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] — strictest current limits among common MCUs
- [[rp2040-peripheral-pin-mapping-eliminates-most-conflicts-because-all-peripherals-remap]] — all peripherals remappable, not just I2C
- [[pico-has-only-3-adc-channels-requiring-external-adc-for-analog-heavy-projects]] — fewest ADC channels among common MCUs
- [[pico-uf2-drag-and-drop-bootloader-eliminates-external-programmers]] — drag-and-drop firmware upload, unbrickable
- [[circuitpython-filesystem-can-consume-half-of-pico-2mb-flash]] — environment choice affects flash budget
- [[pico-lacks-wifi-bluetooth-requiring-pico-w-or-external-wireless]] — no wireless on base Pico; Pico W or ESP bridge
- [[pico-vsys-accepts-1v8-to-5v5-enabling-direct-battery-operation]] — wide input voltage with Schottky backfeed protection
- [[pico-3v3-en-pin-disables-regulator-for-external-sleep-control]] — hardware sleep via regulator disable
- [[arduino-nano-a6-and-a7-are-analog-input-only-pins-that-silently-fail-on-digitalread]] — A6/A7 ADC-only pins, digitalRead compiles but returns garbage
- [[arduino-clone-bootloader-mismatch-causes-upload-failure-that-looks-like-hardware-fault]] — pre-Optiboot bootloader on clones causes avrdude sync error

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
