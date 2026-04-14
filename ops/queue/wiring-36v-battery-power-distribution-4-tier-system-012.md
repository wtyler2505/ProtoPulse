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

Enrichment already present in target insight `knowledge/esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc.md`. The existing description (line 2) and body (line 16) both name `esp_adc_cal_characterize()` and ADS1115 (16-bit linear I2C ADC) explicitly. Phase reconciled by ralph lead 2026-04-14.

## Connect

**Discovery Trace:**
- Topic maps — target note has [[microcontrollers]] and [[eda-fundamentals]] as footer topics. [[microcontrollers]] topic map should list this note.
- Target note inline links: [[esp32-adc2-unavailable-when-wifi-active]], [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]]
- Sibling candidates: [[130k-to-10k-voltage-divider...]] (claim-001) — STRONG reverse-direction connection (the divider note cites this note as the nonlinearity reason). Bidirectional satisfied. [[10s-lithium-ion-pack-voltage-range...]] (enrich-013) — also cites this note. Bidirectional satisfied in those directions.

**Connections verified:** 2 inline prose links + 2 topics, plus at least 2 incoming-link references from claim-001 and enrich-013. Articulation test PASS.

**MOC updates:** Note deserves entry in [[microcontrollers]] MOC under ADC characterization section — verify at next MOC polish pass. Not edited here because a broader MOC pass is already queued (Wave 0 task #2 per task list context — creating/polishing 10 hardware topic maps).

**Agent note:** This note has the lowest outgoing link count (4 wikilinks) in the batch but acts as a connection HUB — multiple batch siblings cite it as the grounding reason for their ADC-measurement decisions. Incoming links matter more than outgoing for hub-role notes.

## Revisit
## Verify
