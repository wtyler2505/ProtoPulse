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

**Backward pass scope:** heavy processing depth + related scope. Siblings already processed (LiFePO4 12S, 130K divider) verified correctly back-reference this note. Semantic neighbors from earlier source waves checked.

**Changes applied to target note:**

| Type | Description |
|------|-------------|
| connection | added inline prose linking decision thresholds to [[lvd-hysteresis-with-reconnect-voltage-above-cutoff-prevents-oscillation-at-the-threshold-boundary]] and [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] — articulates WHY warning/critical/e-stop thresholds cluster at 30-32V (the firmware must act before the BMS kills logic supply) |
| connection | added footer links to [[lvd-hysteresis...]], [[bms-discharge-port...]], and [[lifepo4-12s-pack-nominal-38v4...]] — the LiFePO4 note already back-references this note and articulates the denominator retune (42V -> 43.8V); adding the reverse edge closes the pair |

**Changes applied to sibling note (forward-connection fix):**

| Type | Description |
|------|-------------|
| connection | added [[linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion...]] and [[130k-to-10k-voltage-divider...]] to Relevant Notes in `10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect.md` — the voltage-range note had an ADC-readings table but no forward link to the firmware mapping consumer of those readings |

**Claim status:** unchanged — original claim is sharp, well-defended, and current. The nuance (accuracy only matters where linear and true curves converge) is the core insight and survives reconsideration.

**Network effect:**
- Outgoing links on target: 3 inline + 3 footer -> 5 inline + 6 footer
- New bidirectional edges: target <-> LVD hysteresis, target <-> BMS discharge port, target <-> LiFePO4 12S, target <-> 10S voltage range (previously one-way from target)
- The BMS -> LVD -> linearization -> ADC -> divider measurement chain is now fully navigable in both directions

**MOC updates:** [[power-systems]] Batteries section entry verified — phrasing "SOC linearization is adequate for fuel-gauge UI despite curve nonlinearity" still captures the claim. No change needed.

**Agent traversal value:** An agent debugging "battery reads 50% but rover stops unexpectedly" can now traverse target -> LVD hysteresis to understand the disconnect-threshold envelope, or target -> BMS discharge port to understand why the 30V floor is a hard power cutoff, not just a UI minimum.

## Verify

**Target note:** `knowledge/linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve.md`

**Gate 1 — Description quality:** PASS. Description is specific, adds information beyond the title (includes numbers, rationale, mechanism), and a cold reader could predict the claim's title from it.

**Gate 2 — Schema compliance:** PASS. All required fields present (description, type, created: 2026-04-14, source, confidence: proven, topics, related_components).

**Gate 3 — Graph integrity:** PASS. All 15 wiki-links resolve.

**Result:** All gates PASS. No gaps.
