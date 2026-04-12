---
description: "The W5100 runs TCP/IP in silicon so the MCU just opens sockets — zero RAM cost but a hard 4-socket ceiling, unlike ESP8266/ESP32 which burn 50KB+ RAM for a software stack"
type: claim
source: "docs/parts/velleman-pka042-ethernet-shield-w5100-for-arduino.md"
confidence: proven
topics:
  - "[[communication]]"
related_components:
  - "velleman-pka042-ethernet-shield"
---

# W5100 hardware TCP/IP offload means the MCU never touches packet framing which trades socket count for code simplicity

The Ethernet shield's W5100 chip handles the entire TCP/IP stack in hardware. The sketch calls `Ethernet.begin(mac)` and immediately makes HTTP requests or runs a web server — the ATmega never allocates buffers for packet framing, TCP state machines, or retransmission timers. The trade-off is a hard ceiling of 4 simultaneous TCP/UDP sockets, baked into the silicon.

This is the opposite architectural choice from ESP8266/ESP32 WiFi modules, where TCP/IP runs as a software stack consuming ~50KB of RAM (per [[esp8266-wifi-consumes-50kb-ram-leaving-only-30kb-for-user-code]]). The ESP approach gives flexible socket counts and protocol options but burns scarce SRAM. The W5100 approach gives zero-RAM networking but with rigid limits.

**When each pattern wins:**
- **Hardware offload (W5100):** Best when the MCU has limited RAM (ATmega328P: 2KB) and the project needs simple, reliable networking (data logging, sensor reporting, basic web UI). The 4-socket limit rarely matters for single-purpose IoT nodes.
- **Software stack (ESP8266/ESP32):** Best when the project needs WiFi, TLS, WebSocket, MQTT, or more than 4 concurrent connections. The RAM cost is acceptable because the ESP32 has 520KB SRAM.

**ProtoPulse implication:** When the AI recommends networking for an Arduino project, it should distinguish hardware-offloaded Ethernet (simple, wired, RAM-free) from software-stack WiFi (flexible, wireless, RAM-hungry). The BOM builder should flag RAM pressure when pairing ESP8266 WiFi with memory-intensive features.

---

Relevant Notes:
- [[esp8266-wifi-consumes-50kb-ram-leaving-only-30kb-for-user-code]] -- contrast: software stack side of the same trade-off
- [[shield-pin-conflicts-are-invisible-until-stacking-fails]] -- W5100 shield pin usage and stacking concerns
- [[spi-bus-sharing-on-a-single-shield-requires-per-device-chip-select-discipline-where-unused-devices-must-be-explicitly-deselected]] -- the Ethernet shield itself has two SPI devices

Topics:
- [[communication]]
