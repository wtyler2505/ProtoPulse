---
description: "The single ADC channel accepts 0-1V maximum with 10-bit resolution -- reading 3.3V signals requires a 220k+100k voltage divider, and mistaking this for the ESP32's 0-3.3V range damages the ADC"
type: claim
source: "docs/parts/esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp8266-nodemcu-amica"
---

# ESP8266 A0 analog input has a 0-1V range not 0-3.3V which is a common misconception

The ESP8266 has exactly one analog input (A0) with a 10-bit ADC. Its input range is 0 to 1.0V — not 0 to 3.3V like the ESP32's default 11dB attenuation setting. This is one of the most common misconceptions when transitioning from ESP32 documentation to ESP8266, or when assuming "3.3V board = 3.3V ADC range."

Applying 3.3V directly to A0 will not immediately destroy the chip (the pin has some overvoltage tolerance), but readings will be saturated at maximum (1023) for any voltage above 1V, providing no useful measurement. Repeatedly exceeding the rated input range risks gradual degradation of ADC accuracy.

**To read a 3.3V signal:** Use a voltage divider. A 220k + 100k resistor pair produces ~1.03V from 3.3V input — close enough for the 10-bit ADC's ~1mV per step resolution. For a 5V signal (from a sensor powered by Arduino), use 330k + 100k to scale 5V down to ~1.16V (slightly over-range, clamp with a Zener or use 390k + 100k for exactly 1.02V).

**Contrast with ESP32:** The ESP32 has 18 ADC channels across two peripherals, configurable attenuation (0-1.1V, 0-1.5V, 0-2.2V, or 0-3.3V per pin), and 12-bit resolution. The ESP8266's single 10-bit 0-1V channel is dramatically more limited — if you need more than one analog input, add an external ADC (ADS1115 for 16-bit 4-channel I2C, or MCP3008 for 8-channel SPI).

**ProtoPulse implication:** The bench coach should flag any direct connection to A0 from a signal source greater than 1V. The schematic DRC should check source voltage against the 1V maximum and suggest a voltage divider with calculated resistor values.

---

Relevant Notes:
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] — ESP32 has configurable attenuation; ESP8266 is fixed at 0-1V with no configuration options
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] — both ESPs have ADC limitations, but ESP8266's is simpler (just range) while ESP32's is accuracy

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
