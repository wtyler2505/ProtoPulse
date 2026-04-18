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

**Backward pass 2026-04-14.** Target note already had 4 inline prose links + 2 topics from connect phase. Three new connections added based on sibling notes created in the same wave (2026-04-14) that explicitly reference this note:

- **Claim precision sharpened**: added "NMC cells" qualifier in opening sentence and a paragraph scoping the 30V-42V envelope as NMC-specific — prevents misreading as a general "36V lithium" claim when 12S LiFePO4 lives at 30-43.8V.
- **`[[lvd-hysteresis-with-reconnect-voltage-above-cutoff-prevents-oscillation-at-the-threshold-boundary]]`** added (inline in new system-design point 5 + footer). Why: LVD note references this as "the voltage range where LVD thresholds are set" — closes the bidirectional link. The 30V BMS cutoff is the anchor point for external LVD hysteresis design.
- **`[[lifepo4-12s-pack-nominal-38v4-exceeds-36v-design-target-and-must-be-verified-against-controller-upper-limit]]`** added (inline scoping paragraph + footer). Why: LiFePO4 note names this note as the NMC baseline it compares against; target should acknowledge the alternative chemistry context so readers don't over-generalize.
- **`[[nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety]]`** added (inline + footer). Why: the chemistry-level decision this voltage curve lives under; was already listed as "relevant note" in nmc-vs-lifepo4 but reverse link was missing.

**Claim status**: sharpened (scope narrowed to NMC explicitly; core claim unchanged).

**Network effect**: outgoing prose links 4→7 (adds LVD, LiFePO4, NMC-vs-LFP). Target now bridges the firmware-monitoring cluster (divider, ESP32 ADC, linear V%) with the chemistry-choice cluster (NMC vs LFP, lead-acid) and the threshold-design cluster (LVD hysteresis). Incoming-link dominance preserved — still a hub in the "10S Li-Ion design envelope" cluster.

**MOC**: no power-systems update needed; the note's entry already captures the right summary ("36V nominal is only a moment on the discharge curve").

**Not changed**: title (already sharp — "usable window is narrower than beginners expect" is arguable). No split (single coherent claim about the voltage envelope + firmware monitoring implications). No challenge (claim holds against all evidence encountered). Didn't add ADS1115 as a direct sibling link in body — already present in existing ESP32 ADC nonlinearity inline link.

## Verify

**Target note:** `knowledge/10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect.md`

**Gate 1 — Description quality:** PASS. Description is specific, adds information beyond the title (includes numbers, rationale, mechanism), and a cold reader could predict the claim's title from it.

**Gate 2 — Schema compliance:** FLAGGED. Missing `created:` field. Other required fields present (description, type, source, confidence: proven, topics, related_components).  FIX NEEDED: add `created:` date.

**Gate 3 — Graph integrity:** PASS. All 16 wiki-links resolve.

**Result:** Gate 1 PASS, Gate 2 FAIL (missing created), Gate 3 PASS. Non-blocking.
