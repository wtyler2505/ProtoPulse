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

**ADC configuration beyond WiFi:** Even when using ADC1, accuracy depends on the attenuation setting. The ESP32 ADC has four attenuation levels (0dB=0-1.1V, 2.5dB=0-1.5V, 6dB=0-2.2V, 11dB=0-3.3V) configured per-pin via `analogSetPinAttenuation()`. Default is 11dB (full range). The ADC is also nonlinear above ~2.5V at any attenuation -- for precision applications, use Espressif's `esp_adc_cal_characterize()` for per-chip calibration or an external ADS1115 for guaranteed linearity.

---

Relevant Notes:
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- GPIO12 is also an ADC2 pin, compounding the risk
- [[esp32-six-flash-gpios-must-never-be-used]] -- another class of "looks usable but isn't"
- [[all-procurement-data-is-ai-fabricated]] -- same anti-pattern at the data layer: something appears available but silently fails
- [[esp32-38pin-barely-fits-breadboard-with-one-free-column]] -- physical fit + unusable pins compound the ESP32's deceptive complexity
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- ADC2 silent failure is the archetype of mistakes only proactive AI can catch before wasted debugging hours
- [[mega-2560-four-hardware-uarts]] -- both boards have pin multiplexing gotchas a unified tool must surface (ADC/WiFi on ESP32, UART/interrupt sharing on Mega)

Topics:
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
