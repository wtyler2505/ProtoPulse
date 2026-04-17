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

The ESP32's 12-bit ADC (4096 steps over the configured voltage range) has a well-documented nonlinearity problem at the upper end of its range. Even at 11dB attenuation (full 0-3.3V input range -- see [[esp32-adc-attenuation-setting-determines-input-voltage-range]] for the four attenuation levels and the range/resolution tradeoff), readings above approximately 2.5V diverge significantly from the expected linear response curve. The ADC essentially "compresses" at the top end, reporting values lower than actual voltage.

Espressif provides `esp_adc_cal_characterize()` in the ESP-IDF to apply per-chip calibration using factory-burned eFuse values. This improves accuracy but doesn't eliminate the fundamental nonlinearity. For applications where ADC precision matters (battery voltage monitoring, analog sensor calibration, precision measurement), an external I2C ADC like the ADS1115 (16-bit, linear across its full range) is the standard solution -- the same escape route used on platforms with insufficient built-in ADC like [[pico-has-only-3-adc-channels-requiring-external-adc-for-analog-heavy-projects]] and [[raspberry-pi-has-zero-built-in-adc-requiring-external-mcp3008-or-ads1115-for-any-analog-input]].

The practical design consequence is that circuits feeding this ADC should keep the signal of interest below ~2.5V. [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]] is one example: the divider maps a 42V battery to 3V at full charge, placing the useful operating range (30V BMS cutoff at 2.14V up through 36V nominal at 2.57V) almost entirely inside the cleaner sub-2.5V window. Applications that cannot avoid the upper range should commit to `esp_adc_cal_characterize()` + oversampling or an external ADS1115 rather than accepting raw reading error silently.

For many maker applications (rough potentiometer position, light-level thresholds, basic voltage monitoring), the built-in ADC is adequate without calibration. The danger is when someone builds a precision voltmeter or calibrated sensor system trusting the raw ADC values at higher voltages.

**Practical noise mitigation for resistive sensors (LDRs, thermistors, FSRs):**
- Use `analogReadMilliVolts()` (available on ESP-IDF 4.4+ / Arduino ESP32 core 2.0+) which applies factory calibration automatically, returning millivolts instead of raw ADC counts
- Average multiple samples to reduce noise: 16-64 samples with 1-5ms spacing is typical for sensors like LDRs where the physical quantity changes slowly
- Both techniques combined give adequate precision for threshold-based decisions without an external ADC

---

Relevant Notes:
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] -- the 11dB attenuation referenced throughout this note; the attenuation setting selects which voltage window the nonlinearity appears in
- [[esp32-adc2-unavailable-when-wifi-active]] -- ADC2 is locked out by WiFi; this note covers a separate issue affecting ADC1 accuracy
- [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]] -- practical consequence: dividers are sized to keep the operating range below 2.5V specifically because of this nonlinearity
- [[linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve]] -- downstream consumer where ADC measurement error compounds with model approximation error in the battery-percent decision chain
- [[pico-has-only-3-adc-channels-requiring-external-adc-for-analog-heavy-projects]] -- a different MCU constraint that also pushes designs toward ADS1115 over I2C
- [[raspberry-pi-has-zero-built-in-adc-requiring-external-mcp3008-or-ads1115-for-any-analog-input]] -- shares the ADS1115 escape route; RPi is forced there by architecture, ESP32 by accuracy
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] -- both platforms have analog measurement gotchas that beginners don't expect

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
