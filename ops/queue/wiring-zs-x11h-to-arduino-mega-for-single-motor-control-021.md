---
claim: "STOP is the correct emergency kill and CT brake is for controlled deceleration because only STOP removes controller power path entirely"
classification: closed
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
semantic_neighbor: "bldc-stop-active-low-brake-active-high"
---

# Claim 021: STOP is the correct emergency kill and CT brake is for controlled deceleration because only STOP removes the controller power path entirely

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 75, 237-238)

## Reduce Notes

Extracted from wiring-zs-x11h-to-arduino-mega-for-single-motor-control. This is a CLOSED claim.

Rationale: The source explicitly states "For emergency stop, use STOP (LOW) instead of brake — it disables the controller entirely. Brake is for controlled deceleration, not emergency stop." This is a role/hierarchy claim distinct from polarity claims — it argues WHICH pin to use for WHICH safety purpose, based on what each signal mechanically does. STOP removes drive signals to the MOSFETs (de-energizes phases). Brake shorts phases through low-side MOSFETs. In an emergency, you want to stop drawing energy from the system, not convert it to heat in the controller.

Semantic neighbor: [[bldc-stop-active-low-brake-active-high]] — DISTINCT because that existing note argues the polarity convention (with a different controller). This claim argues the functional role hierarchy: STOP is the master kill, brake is a deceleration tool. The existing note covers "what voltage activates each" — this covers "when to use each."

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
