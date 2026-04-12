---
description: "Breaks out all Arduino Mega I/O pins to 3-pin headers (Signal/VCC/GND) — the Mega version of a sensor shield for clean multi-sensor wiring"
topics: ["[[shields]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [GPIO, I2C, SPI, UART, Analog]
logic_level: "5V"
manufacturer: "SainSmart"
part_number: "SS-MEGA-SENS-V2"
pinout: |
  All Arduino Mega I/O broken out to 3-pin headers:
  Digital D0-D53 → 3-pin (S/V/G)
  Analog A0-A15  → 3-pin (S/V/G)
  I2C header     → SDA(D20), SCL(D21), VCC, GND
  UART headers   → Serial1, Serial2, Serial3
  ICSP passthrough
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]"]
used_in: []
warnings: ["Mega form factor — will NOT fit on Uno", "3-pin headers provide 5V — use level shifter for 3.3V sensors", "Stacking height adds ~10mm — check clearance if mounting in an enclosure"]
datasheet_url: ""
---

# SainSmart Mega Sensor Shield V2 — 3-Pin Breakout

The Mega version of a sensor shield. Breaks out all 54 digital and 16 analog pins to 3-pin headers. With the Mega's 70+ I/O pins, this shield turns the board into a proper sensor/servo hub without breadboard spaghetti. Multiple UART headers make it easy to connect Bluetooth, GPS, and other serial modules simultaneously.

## Specifications

| Spec | Value |
|------|-------|
| Form Factor | Arduino Mega shield |
| Digital Headers | D0-D53 (3-pin each) |
| Analog Headers | A0-A15 (3-pin each) |
| Serial Headers | Serial1, Serial2, Serial3 |
| I2C | Dedicated header (SDA/SCL) |
| VCC Rail | 5V from Mega |

---

Related Parts:
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — the board this shield is designed for
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same pin layout and shield compatibility
- [[osepp-sensor-shield-3-pin-breakout-for-arduino-uno]] — Uno version

Categories:
- [[shields]]
