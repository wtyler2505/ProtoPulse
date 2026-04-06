---
description: "ADC2's 10 channels share hardware with the WiFi radio and cannot be read while WiFi is connected"
type: claim
source: "shared/verified-boards/nodemcu-esp32s.ts"
confidence: proven
topics: ["[[eda-fundamentals]]", "[[breadboard-intelligence]]"]
related_components: ["shared/verified-boards/nodemcu-esp32s.ts"]
---

# ESP32 ADC2 channels are completely unavailable when WiFi is active

The ESP32 has two ADC peripherals: ADC1 (8 channels on GPIO 32-39) and ADC2 (10 channels on GPIO 0, 2, 4, 12-15, 25-27). ADC2 shares internal hardware resources with the WiFi radio transceiver. When WiFi is initialized — even if no data is actively being sent — the ADC2 peripheral is locked out entirely. Calls to `analogRead()` on ADC2 pins return garbage or fail silently.

This is not a performance degradation or a priority conflict. ADC2 is physically unavailable. The WiFi radio uses the same SAR (Successive Approximation Register) hardware, and there is no time-multiplexing or arbitration. Espressif documents this clearly in the ESP-IDF API reference, but the Arduino `analogRead()` wrapper gives no compile-time warning and no runtime error — it just returns meaningless values.

The practical rule: if your project uses WiFi (and most ESP32 projects do), design all analog sensing around ADC1 channels only. ADC1 covers GPIO 32, 33, 34, 35, 36 (VP), and 39 (VN) — six usable channels (plus two more on GPIO 36/39 that double as the internal hall sensor). If you need more than six analog inputs with WiFi, use an external ADC (ADS1115, MCP3008) over I2C or SPI.

---

Relevant Notes:
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- GPIO12 is also an ADC2 pin, compounding the risk
- [[esp32-six-flash-gpios-must-never-be-used]] -- another class of "looks usable but isn't"

Topics:
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
