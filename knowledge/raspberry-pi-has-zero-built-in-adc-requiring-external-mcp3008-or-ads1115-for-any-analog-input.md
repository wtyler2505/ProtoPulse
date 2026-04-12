---
description: "Unlike every MCU in the inventory, the Raspberry Pi has NO analog input -- any analog sensor requires an external ADC chip (MCP3008 via SPI or ADS1115 via I2C)"
type: claim
source: "docs/parts/raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "raspberry-pi-3b-plus"
---

# Raspberry Pi has zero built-in ADC requiring external MCP3008 or ADS1115 for any analog input

The Raspberry Pi 3B+ has no analog-to-digital converter whatsoever. Every GPIO pin is purely digital. This is a fundamental architectural difference from microcontrollers:

| Board | ADC Channels | Resolution | Interface |
|-------|-------------|------------|-----------|
| Arduino Uno | 6 (A0-A5) | 10-bit | Built-in |
| Arduino Mega | 16 (A0-A15) | 10-bit | Built-in |
| Arduino Nano | 8 (A0-A7) | 10-bit | Built-in |
| ESP32 | 18 (ADC1 + ADC2) | 12-bit | Built-in |
| ESP8266 | 1 (A0) | 10-bit | Built-in |
| Pi Pico | 3 (GP26-GP28) | 12-bit | Built-in |
| **Raspberry Pi** | **0** | **N/A** | **None** |

For any analog sensor (potentiometer, photoresistor, thermistor, analog joystick, soil moisture, gas sensor), the RPi requires an external ADC:

- **MCP3008** -- 8-channel, 10-bit, SPI interface. Cheap (~$2), easy to wire, plenty for most hobby projects. Best default choice.
- **ADS1115** -- 4-channel, 16-bit, I2C interface. Higher resolution for precision measurements. Supports differential mode.
- **ADS1015** -- 4-channel, 12-bit, I2C. Faster sampling rate (3300 SPS vs ADS1115's 860 SPS) but lower resolution.

This means every RPi project that reads analog sensors has a hidden BOM cost and wiring complexity that MCU projects don't. A potentiometer that connects to an Arduino with one wire requires an MCP3008 + 4 SPI wires + a decoupling cap on the RPi.

**ProtoPulse implication:** When a user adds an analog sensor to a design containing only an RPi (no MCU companion), the BOM engine should automatically suggest adding an external ADC and surface the additional wiring requirements. This is a case where the "missing peripheral" detection would save beginners hours of confusion.

---

Relevant Notes:
- [[pico-has-only-3-adc-channels-requiring-external-adc-for-analog-heavy-projects]] -- Pico has the fewest MCU ADC channels; RPi has zero
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- even MCUs with built-in ADC have quality limitations

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
