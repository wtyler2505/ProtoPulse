---
claim: "130K to 10K voltage divider scales 42V battery maximum to 3V ADC input with safety margin"
classification: closed
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc"
---

# Claim 001: 130K to 10K voltage divider scales 42V battery maximum to 3V ADC input with safety margin

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 220-245)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is a CLOSED claim.

Rationale: The source presents the specific resistor values (130K/10K) and explains the trade-off between the naive 100K/10K choice (which reads 3.82V at 42V, exceeding ADC safe range) and the corrected design (3.0V at 42V with headroom for transients). This design decision is a distinct extractable claim that connects ADC nonlinearity, attenuation configuration, and battery voltage range into a concrete wiring pattern.

Semantic neighbor: esp32-adc-is-nonlinear-above-2v5 covers the ADC limitation generically; this claim is DISTINCT because it prescribes the specific divider design that keeps the measurement in the ADC's usable region.

---

## Create

Insight exists at `knowledge/130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin.md`. Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced. Content verified: YAML frontmatter complete (description, type, source, confidence, topics, related_components), body shows divider math with connective reasoning across nominal/cutoff/max states, wiki-linked to `[[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]]`, `[[esp32-adc-attenuation-setting-determines-input-voltage-range]]`, `[[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]]`. Footer has Source, Relevant Notes, Topics sections.

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
