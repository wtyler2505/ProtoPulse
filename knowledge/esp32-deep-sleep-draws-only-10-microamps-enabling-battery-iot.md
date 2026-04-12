---
description: "At ~10uA deep sleep current the ESP32 can run for months on a coin cell or small LiPo with periodic wake-and-transmit cycles"
type: claim
source: "docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[communication]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# ESP32 deep sleep draws only 10 microamps enabling battery-powered IoT designs

The ESP32 has a deep sleep mode that reduces total current consumption to approximately 10 microamps (0.01mA). In this state, the main CPU cores, WiFi radio, Bluetooth, and most peripherals are powered down. Only the RTC (Real-Time Clock) controller and select RTC GPIOs remain active, allowing the chip to wake on timer, external GPIO trigger, touch pin activation, or ULP (Ultra-Low Power) coprocessor event.

This makes the ESP32 viable for battery-powered IoT sensor nodes that wake periodically to read a sensor, connect to WiFi, transmit data, and return to sleep. A 1000mAh LiPo battery could sustain a node sleeping 99% of the time for months, even accounting for the 240mA WiFi transmission bursts during the brief awake windows.

The contrast with the active current draw is dramatic: 240mA WiFi peak vs 0.01mA deep sleep -- a 24,000:1 ratio. This means the energy budget is dominated by the awake time, not the sleep time. Optimizing the wake-transmit-sleep cycle (minimizing WiFi connection time, batching sensor reads, using static IP to skip DHCP) has far more impact on battery life than reducing sleep current.

**Dev board caveat:** The USB-serial chip (CP2102 or CH340) on NodeMCU dev boards draws its own quiescent current (~10-20mA) from the USB rail, which defeats deep sleep power savings. True battery-powered deployments use bare ESP32 modules or dev boards with power-path control.

---

Relevant Notes:
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] -- active power budget; deep sleep is the opposite extreme
- [[esp32-adc2-unavailable-when-wifi-active]] -- wake-transmit cycles must sequence ADC reads before WiFi init if ADC2 channels are needed

Topics:
- [[microcontrollers]]
- [[communication]]
- [[eda-fundamentals]]
