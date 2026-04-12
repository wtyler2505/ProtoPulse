---
description: "D1(GPIO5), D2(GPIO4), D5(GPIO14), D6(GPIO12), D7(GPIO13) have no boot restrictions or special functions -- the remaining 6 all have caveats that trip beginners"
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

# ESP8266 has only 5 truly safe GPIO out of 11 total pins

The ESP8266 NodeMCU exposes 11 usable GPIO pins (D0-D8, TX, RX) plus one analog input (A0). Of these, only 5 are free from boot mode restrictions, serial functions, or architectural quirks: D1 (GPIO5), D2 (GPIO4), D5 (GPIO14), D6 (GPIO12), and D7 (GPIO13).

The remaining 6 pins all carry caveats:

- **D0 (GPIO16)** — Cannot do PWM or I2C. Connected to a different internal peripheral. Only useful for deep sleep wake or simple digital I/O.
- **D3 (GPIO0)** — Boot mode pin. Must be HIGH at boot for normal operation; LOW enters flash/upload mode. The physical FLASH button on the board pulls this LOW.
- **D4 (GPIO2)** — Boot mode pin. Must be HIGH at boot. Shares the onboard LED (active LOW).
- **D8 (GPIO15)** — Boot mode pin. Must be LOW at boot. External pull-down on most boards.
- **TX (GPIO1)** — UART serial output. Spews debug messages at boot (74880 baud). Unusable as GPIO without losing serial communication.
- **RX (GPIO3)** — UART serial input. Needed for programming and serial monitor.

This 5-out-of-11 ratio is even more constrained than the ESP32's 14-out-of-34 — in absolute terms, the ESP8266 gives you fewer safe pins than an Arduino Nano's 14 digital pins. The practical implication: wire your critical peripherals to D1, D2, D5, D6, D7. Every other pin requires understanding its specific constraints before use.

**ProtoPulse implication:** The breadboard bench coach should visually distinguish the 5 safe pins (green) from the 6 restricted pins (yellow/red). Auto-routing should prefer the safe pins and warn when restricted pins are assigned to peripherals that conflict with their boot or architectural limitations.

---

Relevant Notes:
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] — same pattern on the ESP32 but with different numbers and different pin identities
- [[esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on]] — the mechanism that restricts 3 of the 6 unsafe pins

Topics:
- [[microcontrollers]]
- [[breadboard-intelligence]]
- [[eda-fundamentals]]
