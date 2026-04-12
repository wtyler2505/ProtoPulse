---
description: "The CP2102/CH340 USB-serial chip and onboard voltage regulator stay powered from USB, drawing 8-20mA even when the ESP8266 chip is in 20uA deep sleep"
type: claim
source: "docs/parts/esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp8266-nodemcu-amica"
---

# NodeMCU board draws 8-20mA in deep sleep defeating the chip-level 20uA specification

The ESP8266 chip itself draws approximately 20 microamps in deep sleep — a stellar number for battery-powered IoT sensor nodes. However, the NodeMCU development board adds components that remain powered regardless of the chip's sleep state:

- **USB-serial chip** (CP2102 or CH340): draws 5-15mA quiescent current
- **AMS1117-3.3 voltage regulator**: draws 3-5mA quiescent current even at zero load
- **Power LED** (if present): 1-3mA

Together, these board components consume 8-20mA — a factor of 400-1000x more than the ESP8266 chip alone. A 2000mAh battery that would last months at 20uA drains in under 10 days at board-level sleep current.

**The implication:** NodeMCU boards are prototyping tools, not deployment platforms for battery-powered applications. True ultra-low-power deployments require either:

1. **Bare ESP-12E module** powered directly at 3.3V from an efficient LDO or buck converter (bypassing the inefficient AMS1117)
2. **Power-path control** — a MOSFET or load switch that disconnects the USB-serial chip from power during sleep (some custom boards implement this)
3. **Alternative dev boards** designed for low power (e.g., boards with MCP1700 regulator at 1.6uA quiescent)

This pattern applies identically to ESP32 NodeMCU boards — the existing note on ESP32 deep sleep mentions the same caveat. The board-vs-chip current distinction is universal across all dev boards with always-on USB bridges and linear regulators.

**Boards with integrated chargers add another always-on component.** The SparkFun Blynk Board includes an MCP73831 LiPo charger IC that has its own quiescent current (~50-100uA typical for MCP73831 in standby). While small compared to the USB-serial chip's 5-15mA, it stacks on top of everything else. The tradeoff is explicit: "easy battery deployment with slightly higher sleep current" vs "lower sleep current but you need an external charger module that you can power-gate." For battery projects where sleep current matters, boards with integrated charging may need a physical power switch rather than relying on deep sleep alone.

---

Relevant Notes:
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] — same board-vs-chip problem on ESP32; mentions CP2102 quiescent draw defeating deep sleep
- [[esp8266-deep-sleep-requires-physical-wire-from-gpio16-to-rst]] — the wake mechanism that enables the deep sleep this note discusses

Topics:
- [[microcontrollers]]
- [[power-systems]]
- [[eda-fundamentals]]
