---
description: "The 12-bit ADC exhibits significant nonlinearity above ~2.5V even at 11dB attenuation -- esp_adc_cal_characterize() provides per-chip correction but an external ADS1115 is the practical solution for precision"
type: claim
source: "docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# ESP32 ADC is nonlinear above 2.5V requiring calibration or external ADC for precision

The ESP32's 12-bit ADC (4096 steps over the configured voltage range) has a well-documented nonlinearity problem at the upper end of its range. Even at 11dB attenuation (full 0-3.3V input range), readings above approximately 2.5V diverge significantly from the expected linear response curve. The ADC essentially "compresses" at the top end, reporting values lower than actual voltage.

Espressif provides `esp_adc_cal_characterize()` in the ESP-IDF to apply per-chip calibration using factory-burned eFuse values. This improves accuracy but doesn't eliminate the fundamental nonlinearity. For applications where ADC precision matters (battery voltage monitoring, analog sensor calibration, precision measurement), an external I2C ADC like the ADS1115 (16-bit, linear across its full range) is the standard solution.

For many maker applications (rough potentiometer position, light-level thresholds, basic voltage monitoring), the built-in ADC is adequate without calibration. The danger is when someone builds a precision voltmeter or calibrated sensor system trusting the raw ADC values at higher voltages.

---

Relevant Notes:
- [[esp32-adc2-unavailable-when-wifi-active]] -- ADC2 is locked out by WiFi; this note covers a separate issue affecting ADC1 accuracy
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] -- both platforms have analog measurement gotchas that beginners don't expect

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
