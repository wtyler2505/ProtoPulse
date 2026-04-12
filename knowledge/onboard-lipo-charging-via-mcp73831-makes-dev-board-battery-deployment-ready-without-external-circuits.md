---
description: "Dev boards with integrated MCP73831 or TP4056 LiPo charger ICs can run from battery with zero external wiring -- a meaningful board selection criterion vs bare breakouts that need separate charger modules"
type: claim
source: "docs/parts/sparkfun-blynk-board-esp8266-wifi-iot-preconfigured.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[power-systems]]"
related_components:
  - "sparkfun-blynk-board"
---

# Onboard LiPo charging via MCP73831 makes a dev board battery-deployment-ready without external circuits

The SparkFun Blynk Board includes an MCP73831 single-cell LiPo charger IC with a JST connector. Plug in a 3.7V LiPo, connect USB, and the board charges the battery while running. Unplug USB and the board runs from battery seamlessly. No external TP4056 module, no voltage divider for monitoring, no power-path switching.

**Boards with integrated charging (examples from the maker ecosystem):**
- SparkFun Blynk Board (MCP73831)
- Adafruit Feather line (MCP73831/MCP73871)
- Adafruit PyGamer (onboard charger)
- TTGO T-Display ESP32 (onboard charger)
- Seeed XIAO series (onboard charger)

**Boards WITHOUT integrated charging (need external module):**
- Arduino Uno/Mega -- no battery support at all
- NodeMCU ESP8266 -- no charger, VIN accepts regulated 3.3V or USB only
- ESP32 DevKit -- some versions have charger, many don't
- Raspberry Pi Pico -- no battery support

**The MCP73831 specifics:**
- Single-cell LiPo (3.7V nominal, 4.2V charged)
- 500mA max charge rate (typical configuration)
- Thermal regulation prevents overheating
- Charge status indicator (LED or GPIO readable)
- No battery protection (relies on the battery's own protection circuit)

**Board selection principle:** If a project needs battery portability, choosing a board with integrated charging saves one BOM item (the charger module), eliminates wiring complexity, and reduces failure points. The tradeoff is slightly higher sleep current (the charger IC has quiescent draw) and less control over charge rate.

**ProtoPulse implications:** The BOM optimization system could detect when a user picks a bare MCU board + external TP4056 charger module and suggest "board X has integrated charging, reducing your BOM by 1 item and simplifying wiring."

---

Relevant Notes:
- [[nodemcu-board-draws-8-20ma-in-deep-sleep-defeating-chip-level-20ua-spec]] -- integrated charger adds to quiescent current in sleep mode
- [[jst-ph-battery-connectors-have-no-universal-polarity-standard-so-reversed-connection-damages-charger-circuits]] -- the charger IC is what gets damaged by reversed polarity

Topics:
- [[microcontrollers]]
- [[power-systems]]
