---
claim: "Per-branch motor fusing enables graceful degradation because a single motor fault blows its own fuse not the main"
classification: closed
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring"
---

# Claim 003: Per-branch motor fusing enables graceful degradation

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 327-342)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is a CLOSED claim.

Rationale: Existing fuse notes cover sizing theory and NEC requirements but do not articulate the architectural pattern of per-branch fusing for fault isolation in N-parallel load systems. The limp-home capability is a concrete behavioral outcome worth capturing.

Semantic neighbor: slow-blow-fuse-sizing covers sizing math; this claim is DISTINCT because it addresses the topology decision (one main vs N branch fuses) rather than individual fuse sizing.

---

## Create

Insight exists at `knowledge/per-branch-motor-fusing-enables-graceful-degradation-because-a-single-motor-fault-blows-its-own-fuse-not-the-main.md`. Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 72 under "Power distribution" with phrase "per-circuit fuses enable graceful degradation"
- Inline body links verified: [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]], [[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity]], [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]], [[hall-sensor-feedback-from-bldc-hub-motors-provides-rpm-and-direction-without-encoders]]
- Sibling candidates evaluated: [[anl-marine-fuse-class...]] — different topology layer (main bus vs branches); not a strong articulation-test pass beyond what power-budget already implies. Skip.

**Connections verified:** 4 inline prose links + 2 topics. Articulation test PASS (fuse-sizing grounds the math, power-budget grounds the hierarchy constraint, four-motor-BMS grounds why firmware limiting complements branch fusing, hall sensor grounds fault detection).

**MOC updates:** [[power-systems]] line 72 entry verified — "individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system" is the existing canonical phrase for this claim. No edit needed.

**Agent note:** Per-branch fusing extends the residential-circuit-breaker pattern to rover design. Pairs tightly with slow-blow-fuse-sizing (size), power-budget-hierarchy (ordering), and four-motor-BMS (firmware complement).

## Revisit
## Verify
