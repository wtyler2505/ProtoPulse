---
type: enrichment
target_note: "[[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]]"
source_task: wiring-36v-battery-power-distribution-4-tier-system
addition: "Specific mention of esp_adc_cal_characterize() as the factory calibration API, and ADS1115 I2C ADC as the external alternative with 16-bit precision — current note references 'calibration' generically without naming the API or the standard external-ADC part"
source_lines: "282-283"
---

# Enrichment 012: ESP32 ADC nonlinearity note — add calibration API and ADS1115 reference

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 282-283)

## Reduce Notes

Enrichment for [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]]. Source provides two concrete implementations of the two escape routes: esp_adc_cal_characterize() for in-chip calibration and ADS1115 for external precision. The current note mentions both strategies abstractly but does not name the specific APIs or parts.

Rationale: Named, searchable parts and APIs are more actionable than generic strategy descriptions. A future reader searching for "ADS1115" or "esp_adc_cal_characterize" should find this note.

---

## Enrich
## Connect
## Revisit
## Verify
