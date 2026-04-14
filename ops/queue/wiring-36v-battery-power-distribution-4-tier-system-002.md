---
claim: "BMS discharge port is the sole power output so a BMS trip kills the MCU along with the motors"
classification: closed
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety"
---

# Claim 002: BMS discharge port is the sole power output so a BMS trip kills the MCU along with the motors

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 186-210)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is a CLOSED claim.

Rationale: The source raises a safety implication that existing BMS notes do not articulate: the discharge port is the single upstream point feeding the entire downstream power tree, so BMS trips are unrecoverable from a firmware perspective. This drives design patterns for non-volatile state persistence.

Semantic neighbor: salvaged-bms-has-unknown-thresholds addresses verification of BMS parameters; this claim is DISTINCT because it addresses the architectural consequence of BMS behavior rather than threshold characterization.

---

## Create

Insight exists at `knowledge/bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors.md`. Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 43 under "Batteries + BMS" with phrase "single-path BMS output means any trip cuts logic supply"
- Inline body links verified: [[persistent-state-must-tolerate-power-loss-at-any-instruction]], [[salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety]], [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]], [[parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators]]
- Sibling candidates evaluated: [[estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal]] — bidirectional link already exists (estop note explicitly cites this claim as the reason aux signaling is needed). No edit required.

**Connections verified:** 4 inline prose links + 2 topic wikilinks. Articulation test PASS.

**MOC updates:** [[power-systems]] entry verified — no change.

**Agent note:** This claim acts as a hub — it grounds the persistent-state claim and the estop-aux-contact claim by establishing that graceful shutdown is impossible under the single-path BMS architecture. Future synthesis opportunity: a claim about "battery-hardware-imposed firmware design constraints" that combines this note with persistent-state and estop-aux.

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
