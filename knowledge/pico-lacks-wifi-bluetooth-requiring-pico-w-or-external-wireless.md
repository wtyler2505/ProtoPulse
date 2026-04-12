---
description: "The basic Pico has no wireless capability -- for connectivity, use the Pico W variant ($6, CYW43439 WiFi+BT) or add an external ESP module as a wireless bridge"
type: claim
source: "docs/parts/raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[communication]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Pico lacks WiFi and Bluetooth requiring the Pico W variant or an external wireless module

The Raspberry Pi Pico (basic model) has no wireless connectivity at all -- no WiFi, no Bluetooth, no BLE. This is a deliberate design choice: keep the base board at $4 with maximum GPIO and let users add connectivity only when needed.

For IoT projects, two paths exist:
1. **Pico W** ($6): Identical RP2040 but adds an Infineon CYW43439 chip providing 802.11n WiFi + Bluetooth 5.2. The CYW43439 uses SPI internally, consuming GP23-25 (not user-accessible) and GP29 for wireless, reducing available GPIO slightly.
2. **External module**: Add an ESP8266 or ESP32 as a wireless coprocessor connected via UART or SPI. Both the Pico and ESP are 3.3V native, so no level shifting is needed -- a significant advantage over the 5V Arduino + 3.3V ESP combination that always requires a level shifter.

MCU selection criteria for wireless:
- **Need WiFi + lots of GPIO + PIO**: Pico W
- **Need WiFi + lots of ADC + Bluetooth + DAC**: ESP32
- **Need WiFi only, minimal I/O**: ESP8266
- **No wireless needed**: Basic Pico (cheaper, more GPIO, simpler)

---

Relevant Notes:
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] -- Pico + ESP is all-3.3V, no level shifting needed
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] -- ESP32 has integrated WiFi + deep sleep; Pico W adds WiFi but sleep story is different
- [[mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules]] -- Mega + ESP needs separate power; Pico + ESP shares 3.3V natively

Topics:
- [[microcontrollers]]
- [[communication]]
- [[eda-fundamentals]]
