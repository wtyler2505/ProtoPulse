---
description: "Breaks out every Arduino Uno I/O pin to 3-pin headers (Signal/VCC/GND) — eliminates loose jumper wires when connecting multiple sensors and servos"
topics: ["[[shields]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [GPIO, I2C, SPI, UART, Analog]
logic_level: "5V"
manufacturer: "OSEPP"
part_number: "OSEPP-SENSHD-01"
pinout: |
  All Arduino Uno I/O broken out to 3-pin headers:
  Digital D0-D13 → 3-pin (S/V/G)
  Analog A0-A5   → 3-pin (S/V/G)
  I2C header     → SDA, SCL, VCC, GND
  UART header    → TX, RX
  ICSP passthrough
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]"]
used_in: []
warnings: ["Uno form factor ONLY — will not fit on Mega (use SainSmart Mega Sensor Shield instead)", "3-pin headers provide 5V on VCC pin — be careful connecting 3.3V sensors directly", "Does not add any I/O — just breaks out existing pins to convenient headers"]
datasheet_url: ""
---

# OSEPP Sensor Shield — 3-Pin Breakout for Arduino Uno

Stacks on top of an Arduino Uno and breaks out every I/O pin to a 3-pin header (Signal, VCC, GND). Instead of rats-nesting jumper wires on a breadboard, you plug sensors and servos directly into the shield headers with 3-pin cables. Massively cleans up wiring for multi-sensor projects.

## Specifications

| Spec | Value |
|------|-------|
| Form Factor | Arduino Uno shield |
| Digital Headers | D0-D13 (3-pin each) |
| Analog Headers | A0-A5 (3-pin each) |
| I2C | Dedicated header |
| UART | Dedicated header |
| VCC Rail | 5V from Arduino |

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — the board this shield is designed for
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] — OSEPP Uno clone, same shield compatibility
- [[sainsmart-mega-sensor-shield-v2-3-pin-breakout]] — same concept for Arduino Mega

Categories:
- [[shields]]
