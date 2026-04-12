---
description: "Four attenuation levels (0dB/1.1V, 2.5dB/1.5V, 6dB/2.2V, 11dB/3.3V) select the ADC input window -- default 11dB gives full range but 0dB gives better resolution for low-voltage sensors"
type: claim
source: "docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# ESP32 ADC attenuation setting determines input voltage range and must be configured before reading

The ESP32's 12-bit ADC has a configurable input attenuator that trades voltage range for resolution. The four levels are:

| Attenuation | Input Range | Resolution (per step) | Best For |
|-------------|-------------|----------------------|----------|
| 0 dB | 0 - 1.1V | ~0.27mV | High-precision low-voltage sensors |
| 2.5 dB | 0 - 1.5V | ~0.37mV | Small signal measurement |
| 6 dB | 0 - 2.2V | ~0.54mV | Mid-range sensors |
| 11 dB (default) | 0 - 3.3V | ~0.81mV | General purpose, full GPIO range |

The attenuation is set per-pin via `analogSetPinAttenuation(GPIO_PIN, ADC_11db)` in the Arduino framework. The default is 11dB (full 0-3.3V range), which is correct for most applications. However, for a sensor outputting 0-1V (like a current shunt or precision temperature sensor), using 0dB attenuation triples the effective resolution.

The critical mistake is reading an analog pin without realizing the attenuation setting clips the reading. At 0dB attenuation, any voltage above 1.1V reads as the maximum value (4095). If someone switches from an Uno (which has a single fixed 0-5V ADC range) to an ESP32 without understanding attenuation, their readings will be wrong in non-obvious ways.

---

Relevant Notes:
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- even at 11dB, readings are inaccurate above 2.5V
- [[esp32-adc2-unavailable-when-wifi-active]] -- attenuation settings apply to both ADC1 and ADC2 but only ADC1 works with WiFi

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
