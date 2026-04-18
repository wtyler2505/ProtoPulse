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

**Reweave pass:** 2026-04-14 (post-wiring-guide extraction of sibling claims 001-010)

**Connections added inline (6 new):**
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] -- grounds the "10S NMC pack" reference in paragraph 2 with the canonical 30-42V range note
- [[linear-regulator-heat-dissipation-equals-voltage-drop-times-current-making-high-differential-applications-dangerous]] -- supports the LM2596 discussion with the thermal-physics reason linear substitutes are worse at 43.8V
- [[switching-buck-converters-waste-watts-not-volts-making-them-essential-for-large-voltage-differentials]] -- anchors the LM2676/MP2315 50V+ upgrade recommendation
- [[linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve]] -- adds a NEW second-order implication bullet: the SOC function must be retuned from 42V to 43.8V denominator on LiFePO4 swap
- [[lvd-hysteresis-with-reconnect-voltage-above-cutoff-prevents-oscillation-at-the-threshold-boundary]] -- adds a NEW second-order bullet: LVD cutoff is identical but recovery-band behavior differs between chemistries
- [[anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc]] -- replaces the generic "ANL fuses rated 125V DC" prose with a proper link
- [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] -- strengthens the BMS-chemistry-mismatch bullet by chaining to the "BMS is single kill switch" note

**Footer Relevant Notes updated:** 3 entries -> 9 entries (added the 6 new links above plus retained the original 3)

**Claim status: unchanged.** The core claim (LiFePO4 12S systematically elevates downstream voltage and requires component-by-component verification) holds fully. No sharpening or splitting needed -- the claim is already specific and arguable. No challenge raised by newer notes: all sibling claims reinforce the verification cascade.

**Network effect:**
- Outgoing links: 3 -> 9 (200% growth)
- This note now bridges batteries + BMS + regulators + ADC + fusing + firmware-SOC domains via explicit inline chains, matching its actual scope
- OPEN status (from frontmatter) preserved -- the specific datasheet verifications (LM2596 40V confirmed out-of-spec, ZS-X11H 60V confirmed in-spec) are still correct. No verification TODOs closed in this pass; those belong to /verify.

**MOC update (power-systems.md):** NOT needed inline -- this note is already listed under "Batteries + BMS (Li-ion, LiFePO4, lead-acid)" indirectly via [[nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety]]. The previous Connect-phase flag to add it as a standalone bullet under "Batteries + BMS" is still valid; it has not been added yet and should be picked up by the next MOC curation pass. Not blocking progression to /verify.

**Backlinks verified:**
- [[lead-acid-36v-pack...]] already links to this note (one-way reciprocation now complete via new outbound link to the 10S NMC pack note, which lead-acid also references)
- [[nmc-vs-lifepo4...]] -- forward link from this note exists; reciprocation check deferred

## Verify

**Target note:** `knowledge/lifepo4-12s-pack-nominal-38v4-exceeds-36v-design-target-and-must-be-verified-against-controller-upper-limit.md`

**Gate 1 — Description quality:** PASS. Description is specific, adds information beyond the title (includes numbers, rationale, mechanism), and a cold reader could predict the claim's title from it.

**Gate 2 — Schema compliance:** PASS. Required fields present (description, type, created: 2026-04-14, source, confidence: high, topics). No related_components — claim is chemistry-topology level.

**Gate 3 — Graph integrity:** PASS. All 22 wiki-links resolve.

**Result:** All gates PASS. Confidence is 'high' rather than 'proven' — appropriate for a claim that requires per-controller datasheet verification.
