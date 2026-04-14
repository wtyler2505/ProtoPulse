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

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 39 under "Batteries + BMS" with phrase "36V nominal is only a moment on the discharge curve; full range is 30-42V"
- Target note inline links verified (includes 6 siblings): [[130k-to-10k-voltage-divider...]], [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]], [[esp32-adc-is-nonlinear-above-2v5...]], [[four-motor-bldc-systems...]]
- Sibling candidates: [[lifepo4-12s-pack-nominal-38v4...]] (claim-008) — complementary alternative chemistry note. Reverse link exists via nmc-vs-lifepo4 chain; not urgent to add direct link.

**Connections verified:** 4+ inline prose links + 2 topics, plus incoming links from voltage-divider (claim-001), linear-approximation (claim-009), LVD-hysteresis (claim-005). Articulation test PASS.

**MOC updates:** [[power-systems]] entry verified — no change.

**Agent note:** This note is a hub in the "10S Li-Ion design envelope" cluster. Four other notes in this batch cite it. Incoming-link dominance makes it an anchor for battery-related reasoning.

## Revisit
## Verify
