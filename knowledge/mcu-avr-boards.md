---
description: "Arduino Uno, Mega, and Leonardo constraints and quirks"
type: moc
topics:
  - "[[microcontrollers]]"
---

# mcu-avr-boards

Specs, gotchas, and limits for ATmega328P (Uno), ATmega2560 (Mega), and ATmega32U4 (Leonardo).

## Notes
### ATmega Uno ([[hardware-component-atmega328p|ATmega328P]])
- [[uno-single-uart-shared-with-usb-forces-choose-one-between-debugging-and-peripherals]] — #1 Uno beginner wall: can't debug while serial peripheral connected
- [[uno-20ma-per-pin-200ma-total-means-no-direct-led-or-motor-drive]] — ATmega328P GPIO current limits, no direct motor drive
- [[uno-i2c-on-a4-a5-consumes-one-third-of-analog-inputs]] — I2C locks out 2 of 6 analog channels
- [[uno-only-2-external-interrupts-on-d2-d3-is-a-hard-project-sizing-constraint]] — 2 interrupts limit project complexity
- [[uno-defines-the-standard-arduino-shield-header-layout]] — Uno IS the reference form factor for shields
- [[uno-d10-must-stay-output-for-hardware-spi-master-mode]] — D10 INPUT causes silent SPI master-to-slave switch
- [[arduino-nano-a6-and-a7-are-analog-input-only-pins-that-silently-fail-on-digitalread]] — Nano A6/A7 ADC-only pins, digitalRead compiles but returns garbage
- [[arduino-tone-uses-timer2-which-disables-pwm-on-pins-3-and-11-creating-invisible-resource-conflicts]] — tone() silently kills PWM on D3/D11 via Timer2 capture

### ATmega Mega 2560
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] — #1 Uno-to-Mega porting gotcha, silent SPI failure
- [[mega-2560-four-hardware-uarts]] — 4 UARTs make Mega the default choice for multi-wireless projects
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] — header gap preserves Uno shield footprint compatibility
- [[mega-2560-too-wide-for-any-breadboard]] — physical footprint forbids breadboard prototyping
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] — linear regulator heat limits practical Vin to 7-9V
- [[mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules]] — 3.3V pin too weak for ESP/BT modules

### Arduino Leonardo / native-USB AVR
- [[arduino-leonardo-atmega32u4-native-usb-enables-hid-keyboard-mouse-emulation-that-arduino-uno-cannot-do-without-hacking]] — ATmega32U4 built-in USB = native HID keyboard/mouse without DFU hacks
- [[arduino-leonardo-pin-multiplexing-a6-through-a11-doubles-digital-pins-as-adc-channels-unlike-the-uno-where-a0-a5-are-dedicated]] — 12 ADC channels but 6 are multiplexed with digital pins; breaks naive Uno shield assumptions
- [[native-usb-arduino-boards-can-brick-usb-with-a-bad-sketch-requiring-a-double-tap-reset-to-catch-the-bootloader-window]] — bad sketch on Leonardo/Zero can brick USB; recovery requires double-tap reset timing
