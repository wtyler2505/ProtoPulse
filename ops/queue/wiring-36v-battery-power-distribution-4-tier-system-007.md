---
claim: "Lead acid 36V pack from 3 series 12V batteries requires external LVD because no integrated BMS exists"
classification: closed
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety"
---

# Claim 007: Lead acid 36V pack requires external LVD

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 46-60, 174-184)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is a CLOSED claim.

Rationale: The lead-acid option is presented as a distinct battery choice with a specific protection gap (no BMS, requires external LVD). This is a separate decision space from the Li-Ion vs LiFePO4 comparison already captured.

Semantic neighbor: nmc-vs-lifepo4 covers chemistry tradeoffs between two lithium chemistries; this claim is DISTINCT because it covers the non-lithium alternative and its protection requirements.

---

## Create

Insight exists at `knowledge/lead-acid-36v-pack-from-3-series-12v-batteries-requires-external-lvd-because-no-integrated-bms-exists.md`. Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 45 under "Batteries + BMS" with phrase "lead-acid chemistry has no native BMS; LVD is mandatory"
- Inline body links verified: [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]], [[lvd-hysteresis-with-reconnect-voltage-above-cutoff-prevents-oscillation-at-the-threshold-boundary]], [[nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety]]

**Connections verified:** 3 inline prose links + 2 topics. Articulation test PASS (BMS-discharge-port grounds WHY external LVD matters — the absent BMS would otherwise fill this role; LVD-hysteresis grounds the implementation; nmc-vs-lifepo4 grounds the chemistry trade-off that makes lead-acid a considered alternative).

**MOC updates:** [[power-systems]] entry verified — no change.

**Agent note:** Lead-acid vs lithium is often treated as a cost/weight comparison. This note adds the protection-architecture dimension: lithium packs ship with integrated BMS, lead-acid doesn't. That's a real design burden that flips the "lead-acid is simpler" intuition on its head.

## Revisit

**Reweave date:** 2026-04-14 (standard depth, related scope)

**Claim status:** unchanged -- claim holds, title already sharp ("arguable position" test passes: someone could argue lead-acid doesn't *require* external LVD if use is constrained)

**Connections added (2):**
- [[salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety]] -- inline in paragraph 1 and in footer. Articulates the "untrusted BMS" problem as distinct from this note's "no BMS" problem. Agent-traversal value: when choosing pack chemistry, both failure modes are now reachable from either starting point.
- [[lifepo4-12s-pack-nominal-38v4-exceeds-36v-design-target-and-must-be-verified-against-controller-upper-limit]] -- inline in final paragraph and in footer. The final paragraph mentioned "lithium chemistries" abstractly; now it points to a concrete 12S LiFePO4 path with its own cascading voltage burden. Agent-traversal value: "switch to lithium to escape LVD burden" agent now reaches the voltage-compatibility counter-burden on the same link.

**Connections rejected (articulation test failures):**
- 130K voltage divider, linear voltage-to-percentage -- telemetry path concerns. The LVD trip decision is independent of whether the MCU *also* reads pack voltage. An agent following this link would not gain LVD design decisions.
- ANL marine fuse, per-branch motor fusing -- overcurrent protection dimension, orthogonal to over-discharge chemistry.
- E-STOP aux, 10uF ceramic -- different abstraction layers (operator safety, MCU decoupling).
- AC-switch DC arc -- relevant to LVD relay *rating* but not to the existence-of-LVD claim; would dilute.

**MOC updates:** [[power-systems]] already lists this note under "Batteries + BMS" with correct phrasing. No update needed.

**Network effect:** outgoing links 3 -> 5. Bridges to salvaged-hardware domain (via salvaged-bms) and to chemistry-substitution domain (via lifepo4-12s). No new {vocabulary.topic_map} membership, but richer traversal within power-systems.

## Verify

**Target note:** `knowledge/lead-acid-36v-pack-from-3-series-12v-batteries-requires-external-lvd-because-no-integrated-bms-exists.md`

**Gate 1 — Description quality:** PASS. Description is specific, adds information beyond the title (includes numbers, rationale, mechanism), and a cold reader could predict the claim's title from it.

**Gate 2 — Schema compliance:** PASS. Required fields present (description, type, created: 2026-04-14, source, confidence: proven, topics). No related_components — acceptable for a chemistry-level claim.

**Gate 3 — Graph integrity:** PASS. All 13 wiki-links resolve.

**Result:** All gates PASS. No gaps.
