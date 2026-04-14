---
claim: "Motor power wiring below 14AWG overheats at 15A and creates fire risk so gauge is chosen by steady-state current not voltage"
classification: closed
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
semantic_neighbor: null
---

# Claim 019: Motor power wiring below 14AWG overheats at 15A and creates fire risk so gauge is chosen by steady-state current not voltage

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 222)

## Reduce Notes

Extracted from wiring-zs-x11h-to-arduino-mega-for-single-motor-control. This is a CLOSED claim.

Rationale: The Common Mistakes table states "Using thin wire (22AWG) for motor power -> wire overheats at 15A, fire risk. 14AWG minimum for motor power connections." This is a concrete safety rule derived from the ampacity of AWG ratings applied to BLDC motor currents. It is not captured in any existing note — the wiring-36v-battery-power-distribution note addresses battery-to-distribution wiring but not motor-phase wiring. This is a discrete, actionable DRC claim the bench coach should enforce.

Semantic neighbor: None. Distinct from existing fusing, voltage-divider, and battery-distribution notes which argue current protection and voltage scaling respectively — not conductor ampacity.

---

## Create

Created `knowledge/motor-power-wiring-below-14awg-overheats-at-15a-and-creates-fire-risk-so-gauge-is-chosen-by-steady-state-current-not-voltage.md`. Frontmatter: type=claim, topics=[power-systems, eda-fundamentals, actuators]. Body presents I²R reasoning, AWG ampacity table for 22/18/16/14/12, the 6.4x dissipation ratio between 22AWG and 14AWG at 15A, and three wiring classes (phase/main-bus/signal). Wiki-linked to `[[power-budget-hierarchy...]]`, `[[anl-marine-fuse-class...]]`, `[[four-motor-bldc-systems-exceed...]]`, `[[beginners-need-ai-that-catches-mistakes...]]`. Ralph lead 2026-04-14.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note referenced at line 74 of power-systems MOC under power-budget-hierarchy entry via phrase "gauge follows steady-state current, not voltage" as an inline annotation.
- Target note inline links verified: [[power-budget-hierarchy...]] (enrich-016, STRONG DIRECT sibling), [[anl-marine-fuse-class...]] (claim-010), [[four-motor-bldc-systems...]] (enrich-014), [[beginners-need-ai-that-catches-mistakes...]]
- Bidirectional check: power-budget-hierarchy note (enrich-016) explicitly forward-references this note. Link exists both directions via enrich-016 prose.

**Connections verified:** 4 inline prose links + 3 topics. Articulation test PASS (power-budget-hierarchy grounds the ampacity row in the hierarchy; ANL-marine-fuse grounds the fuse-vs-wire coordination; four-motor-BMS grounds the system where 15A/motor adds to 60A total; beginners-need-DRC grounds the case for automatic enforcement).

**MOC updates:** [[power-systems]] already integrates this note via power-budget-hierarchy cross-annotation (line 74 inline-link). No separate entry needed — the connection via power-budget is canonical.

**Agent note:** This is a concrete safety rule (14AWG minimum at 15A) distilled from ampacity tables. The DRC opportunity is clear: given a schematic with stated motor current and chosen wire gauge, the tool can flag undersized conductors before BOM order. Future synthesis candidate: "wire gauge decisions follow steady-state current, fuse decisions follow peak current" — a two-number rule.

## Revisit
(to be filled by revisit phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
