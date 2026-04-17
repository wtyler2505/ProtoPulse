---
description: "AVR microcontroller constraints, Uno and Mega gotchas"
type: moc
topics:
  - "[[eda-fundamentals]]"
---

# eda-avr-constraints

Arduino Uno and Mega constraints, current limits, pin mappings, and hardware quirks.

## Notes
- [[mega-2560-four-hardware-uarts]] -- 4 independent UARTs for simultaneous serial peripherals
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] -- 160mil non-standard gap for Uno shield fit
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- SPI remapping is the #1 Uno-to-Mega porting trap
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] -- linear regulator thermal limits narrow the 7-12V spec to 7-9V practical
- [[mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules]] -- 3.3V header pin cannot power wireless modules
- [[uno-single-uart-shared-with-usb-forces-choose-one-between-debugging-and-peripherals]] -- single UART shared with USB is the #1 Uno beginner wall
- [[uno-20ma-per-pin-200ma-total-means-no-direct-led-or-motor-drive]] -- ATmega328P GPIO current limits require external drivers
- [[uno-i2c-on-a4-a5-consumes-one-third-of-analog-inputs]] -- I2C/analog pin conflict on AVR boards
- [[uno-only-2-external-interrupts-on-d2-d3-is-a-hard-project-sizing-constraint]] -- only 2 interrupts limits project scope
- [[uno-defines-the-standard-arduino-shield-header-layout]] -- Uno is the reference shield form factor
- [[uno-d10-must-stay-output-for-hardware-spi-master-mode]] -- D10 as INPUT silently breaks SPI master mode
