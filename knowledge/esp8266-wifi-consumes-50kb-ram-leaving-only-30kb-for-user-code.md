---
description: "The WiFi stack claims roughly 50KB of the ESP8266's 80KB instruction SRAM, leaving approximately 30KB free -- a hard constraint on program complexity when WiFi is active"
type: claim
source: "docs/parts/esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[communication]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp8266-nodemcu-amica"
---

# ESP8266 WiFi consumes approximately 50KB of RAM leaving only 30KB free for user code

The ESP8266 has 80KB of instruction SRAM plus 32KB of instruction cache RAM. When the WiFi stack is initialized — which happens in virtually every ESP8266 project since WiFi is its primary differentiator — the radio firmware, TCP/IP stack, and connection management consume roughly 50KB. This leaves approximately 30KB of heap available for user application code, variables, buffers, and dynamic allocations.

30KB may sound adequate for a microcontroller, but it evaporates quickly in common IoT scenarios:

- **HTTPS/TLS connections** — a single SSL session needs 15-20KB for the certificate chain and encryption buffers
- **JSON parsing** — a moderately complex API response (weather, MQTT payload) can require 5-10KB for the DOM tree
- **String manipulation** — Arduino String objects fragment the heap rapidly
- **Multiple connections** — each open socket consumes buffer space

The practical result: ESP8266 projects that attempt HTTPS API calls (the most common IoT pattern) often crash with heap exhaustion or memory corruption after running for hours. The failure is intermittent and load-dependent, making it extremely difficult to debug.

**Mitigations:**
- Use MQTT instead of HTTPS (smaller overhead, persistent connection)
- Use streaming JSON parsers (ArduinoJson's `deserializeJson` with `JsonDocument` sized to fit)
- Avoid Arduino `String` — use fixed-size `char[]` buffers
- Monitor free heap with `ESP.getFreeHeap()` during development
- If your application needs TLS + JSON + multiple sensors, step up to ESP32 (520KB SRAM)

**Contrast with ESP32:** The ESP32 has 520KB SRAM total, and WiFi claims roughly 100KB, leaving 300-400KB free — an order of magnitude more headroom. This is why complex IoT applications (web servers, OTA updates, TLS APIs) are viable on ESP32 but fragile on ESP8266.

---

Relevant Notes:
- [[esp32-adc2-unavailable-when-wifi-active]] — another WiFi-related constraint; on ESP8266 it is RAM, on ESP32 it is ADC2
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] — ESP8266 is in the 3.3V wireless family but has this unique RAM limitation

Topics:
- [[microcontrollers]]
- [[communication]]
- [[eda-fundamentals]]
