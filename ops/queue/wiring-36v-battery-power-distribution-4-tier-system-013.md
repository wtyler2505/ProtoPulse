---
type: enrichment
target_note: "[[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]]"
source_task: wiring-36v-battery-power-distribution-4-tier-system
addition: "The ADC-measured voltage readings at each battery state through the 130K/10K divider (3.0V at 42V, 2.57V at 36V, 2.14V at 30V) — concrete numbers that connect the abstract voltage range to the firmware monitoring implementation"
source_lines: "230-245"
---

# Enrichment 013: 10S Li-Ion range — add ADC reading values through divider

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 230-245)

## Reduce Notes

Enrichment for [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]]. Source provides the concrete ADC voltages corresponding to each point on the battery's range (3.0V/2.57V/2.14V at 42V/36V/30V respectively) via the standard 130K/10K divider. This connects the battery characterization to the firmware reading pattern.

Rationale: Numbers turn abstract ranges into actionable calibration targets. A firmware author reading the enriched note can sanity-check their ADC readings directly.

---

## Enrich

Added ADC-reading table to target insight `knowledge/10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect.md` under new "Firmware monitoring" subsection. Table shows pack voltage → divider ADC pin voltage → ADC count (12-bit) for full/nominal/cutoff states, linked to `[[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]]` and `[[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]]`. Ralph lead 2026-04-14.

## Connect
## Revisit
## Verify
