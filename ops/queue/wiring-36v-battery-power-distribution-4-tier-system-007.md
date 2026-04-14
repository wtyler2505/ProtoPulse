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
## Verify
