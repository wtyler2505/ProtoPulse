---
claim: "LiFePO4 12S pack nominal 38V4 exceeds 36V design target and must be verified against controller upper limit"
classification: open
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety"
---

# Claim 008: LiFePO4 12S 38V4 exceeds 36V design target

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 62-77)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is an OPEN claim.

Classification OPEN because: the source raises the voltage compatibility question but does not fully resolve whether specific downstream parts (LM2596 40V max, ZS-X11H 60V max) tolerate the 43.8V peak. Specific verification against actual datasheets is needed to confirm each component's behavior at the upper LiFePO4 range.

Rationale: The chemistry swap from NMC to LiFePO4 is commonly suggested "for safety" but the systematic voltage elevation cascades into multiple downstream component checks. Capturing this as an open claim documents the verification requirement.

Semantic neighbor: nmc-vs-lifepo4 covers the decision at the chemistry level; this claim is DISTINCT because it addresses the specific voltage-compatibility consequence of the 12S configuration required for LiFePO4.

---

## Create

Insight exists at `knowledge/lifepo4-12s-pack-nominal-38v4-exceeds-36v-design-target-and-must-be-verified-against-controller-upper-limit.md`. Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note not yet listed. Candidate addition.
- Inline body links verified: [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]], [[counterfeit-lm2596-chips-are-common-on-cheap-modules-and-fail-under-heavy-load]], [[nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety]]
- Sibling candidates evaluated: [[lead-acid-36v-pack...]] — sister claim about alternative chemistry; not required inline because nmc-vs-lifepo4 already covers the decision layer.

**Connections verified:** 3 inline prose links + 2 topics. Articulation test PASS (voltage-divider grounds the ADC-compatibility verification; counterfeit-lm2596 grounds the buck-converter verification; nmc-vs-lifepo4 grounds the chemistry swap reasoning).

**MOC updates:** [[power-systems]] gap — this specific LiFePO4 12S voltage note is not explicitly cataloged under "Batteries + BMS" although nmc-vs-lifepo4 is. Flagged as potential MOC addition during a later curation pass — body prose already chains into the MOC via nmc-vs-lifepo4.

**Agent note:** This is an OPEN claim (see frontmatter). The voltage compatibility verification remains a live TODO against specific downstream datasheets (LM2596 40V, ZS-X11H 60V). Future revisit pass should track whether these verifications were completed.

## Revisit
## Verify
