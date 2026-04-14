---
claim: "Linear voltage to percentage approximation is adequate for 10S Li-Ion despite the nonlinear discharge curve"
classification: closed
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect"
---

# Claim 009: Linear V-to-% approximation adequate for 10S Li-Ion

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 247-281)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is a CLOSED claim.

Rationale: The trade-off between linear approximation (simple, imprecise in the middle) and Coulomb counting (accurate, complex) is a design decision worth capturing. The key insight is that accuracy only matters in the region where linear and true curves converge (low battery), so the simple approach is justified.

Semantic neighbor: 10s-lithium-ion-pack-voltage-range covers the voltage range; this claim is DISTINCT because it addresses the mapping from voltage to percentage (a firmware decision, not a battery characterization).

---

## Create

Insight exists at `knowledge/linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve.md`. Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 40 under "Batteries + BMS" with phrase "SOC linearization is adequate for fuel-gauge UI despite curve nonlinearity"
- Inline body links verified: [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]], [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]], [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]]

**Connections verified:** 3 inline prose links + 3 topics. Articulation test PASS (voltage-range grounds the 30-42V domain the approximation covers; voltage-divider grounds the measurement mechanism; esp32-adc-nonlinear grounds why the measurement itself has its own nonlinearity to account for).

**MOC updates:** [[power-systems]] entry verified — no change.

**Agent note:** A nice "when simple approximation is justified" claim. The key insight is that accuracy only matters at the low-battery end where linear and true curves converge — so the error-tolerance argument is domain-specific, not generic "linear is good enough." Future synthesis: "accuracy requirements depend on where the user cares about the answer, not on the mathematical fit."

## Revisit
## Verify
