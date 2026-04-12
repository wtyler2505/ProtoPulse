---
description: "Using Wire.h locks out A4 and A5 as analog inputs -- 2 of only 6 channels gone, creating a resource conflict between I2C sensors and analog readings"
type: claim
source: "docs/parts/arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# I2C on A4 and A5 consumes one third of the Uno analog inputs creating a resource conflict

The Arduino Uno's I2C bus (Wire.h) is hardwired to A4 (SDA) and A5 (SCL) -- the same physical pins as analog input channels 4 and 5. Once `Wire.begin()` is called, A4 and A5 are committed to I2C and cannot be used for `analogRead()`. This removes 2 of the Uno's 6 analog inputs, a 33% reduction in analog capacity.

For a project that needs I2C sensors (IMU, RTC, OLED display) AND multiple analog inputs (joystick X/Y, potentiometer, light sensor, temperature), the remaining 4 analog pins (A0-A3) may not be enough. The Mega alleviates this with 16 analog inputs (A0-A15) and dedicated I2C on D20/D21, so I2C doesn't consume any analog channels. The ESP32 sidesteps the problem entirely because its I2C is software-implemented and remappable to any GPIO pair.

The Uno also has internal pull-ups (20-50k ohm) enabled by Wire. For buses with 3+ devices or long wire runs, external 4.7k pull-ups to 5V are recommended. These pull-ups stay active on A4/A5 even if you try to use them for analog after calling `Wire.end()` -- the pin configuration doesn't fully clean up on some Arduino core versions.

---

Relevant Notes:
- [[esp32-i2c-is-software-implemented-and-remappable-to-any-gpio-pair]] -- ESP32 avoids this problem with pin-remappable I2C
- [[mega-2560-four-hardware-uarts]] -- Mega's I2C on D20/D21 doesn't consume analog pins

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
