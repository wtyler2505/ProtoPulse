---
claim: "Direct 36V motor battery to TXS0108E B-side instantly destroys the level shifter because absolute-max VCCB is 5.5V and 36V is seven times that limit"
classification: closed
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
semantic_neighbor: "[[txs0108e-vcca-must-be-the-lower-voltage-rail-because-the-chip-enforces-asymmetric-supply-roles]]"
---

# Claim 045: Direct 36V motor battery to TXS0108E B-side instantly destroys the level shifter

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (lines 72-73)

## Reduce Notes

Extracted from wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter. This is a CLOSED claim.

Rationale: The source flags this as a "Critical Warning" — powering B-side from the 36V motor battery instead of the thin red +5V wire instantly destroys the level shifter and likely the ESP32. This failure mode is not articulated in existing notes. It extends the VCCA-VCCB asymmetry note with a concrete 7x-over-absmax destruction scenario that arises specifically in BLDC+MCU builds where a 36V rail and a 5V logic rail coexist within inches. Future sessions wiring multi-voltage systems need this as a standalone atomic claim that DRC can reference.

Semantic neighbor: [[txs0108e-vcca-must-be-the-lower-voltage-rail-because-the-chip-enforces-asymmetric-supply-roles]] describes asymmetric VCCA<=VCCB invariant within legal range. This is DISTINCT: it addresses the out-of-range destruction case where the motor power rail is mistakenly connected to the logic-level B-side, not the side-swap within-spec case.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
