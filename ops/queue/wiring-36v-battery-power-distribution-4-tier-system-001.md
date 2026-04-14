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

**Discovery Trace:**
- Topic map [[power-systems]] — found: note already listed under "Batteries + BMS" section (line 41)
- Inline body links verified: [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]], [[esp32-adc-attenuation-setting-determines-input-voltage-range]], [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]]
- Sibling scan in batch: no additional strong articulation-test-passing connections found. Divider math is self-contained — the BMS siblings (002, 005, 007) operate on disconnect behavior not measurement; fusing siblings (003, 010) operate on protection not sensing.

**Connections verified:** 3 inline prose links + 2 topics, 0 added (already saturated at creation time). Articulation test PASS for all.

**MOC updates:** [[power-systems]] already contains this note under "Batteries + BMS" sub-heading with contribution phrase "canonical divider for 10S Li-ion → 3V3 ADC" — no change needed.

**Agent note:** Divider note sits at the intersection of ADC characterization and battery voltage range — the three inline siblings form a tight reasoning chain (range -> nonlinearity -> attenuation) that fully explains the design. No synthesis opportunity beyond what the note already states.

## Revisit

**Reweave question:** if this note were written today, what would be different?

Answer: two forward-pointing references were missing because the consumer notes (percentage mapping, ADC1-pin selection) didn't exist or weren't evaluated at creation time. The divider note was correctly connected upstream (range, nonlinearity, attenuation) but orphaned downstream -- no agent traversing from divider could reach "what consumes this measurement" or "where does the output wire go."

**Changes applied:**

| Type | Description |
|------|-------------|
| connection | added inline prose paragraph connecting to [[linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve]] -- establishes the measurement chain divider -> ADC -> linear percent -> decision threshold |
| connection | added inline prose paragraph connecting to [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] -- recommends ADC1 landing pins and explains why the 100nF bypass doubles as the pull-resistor substitute for analog use |
| footer | added both connections to Relevant Notes with relationship articulation |

**Claim status:** unchanged. The 130K/10K ratio and 3.0V safety-margin rationale are proven and self-consistent. Reweave added *downstream* context, not revisions to the core claim.

**Network effect:** outgoing links 3 -> 5. Two new traversal paths:
- divider -> linear-percent (completes the measurement-to-decision chain the agent needs for firmware work)
- divider -> gpio34-39 (answers the "which pin do I wire to" question)

**Agent traversal check:** PASS for both connections. The percent-mapping link enables firmware implementation decisions; the GPIO34-39 link enables wiring/layout decisions. Neither is merely "related" -- both carry operational weight.

**Not changed:**
- LVD hysteresis connection was considered but rejected: LVD can be implemented with a comparator circuit not requiring the MCU's divider at all. The articulation test requires a specific "because" that the LVD note doesn't exercise.
- BMS-discharge-port connection was considered but rejected: the BMS kills power upstream of the divider; they operate at different abstraction layers and forcing a link would just be "related to battery systems."
- Title and description: already sharp and discoverable. No rewrite needed.

**MOC updates:** [[power-systems]] already lists this note under "Batteries + BMS" with an accurate contribution phrase. The new downstream connections are captured in the note body rather than the MOC (the MOC describes what the note is, not everything it now cites).

## Verify
(to be filled by verify phase)
