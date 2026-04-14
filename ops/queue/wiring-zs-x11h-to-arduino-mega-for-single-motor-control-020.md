---
claim: "Motor speed must be ramped below 50 percent before activating the brake because high-speed regenerative braking stresses the controller"
classification: closed
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
semantic_neighbor: "dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets"
---

# Claim 020: Motor speed must be ramped below 50 percent before activating the brake because high-speed regenerative braking stresses the controller

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 234-235)

## Reduce Notes

Extracted from wiring-zs-x11h-to-arduino-mega-for-single-motor-control. This is a CLOSED claim.

Rationale: The "Braking rules" section states "Reduce speed below 50% before activating brake — high-speed braking at high voltage stresses the controller." This is a speed-threshold rule distinct from the existing dynamic-brake-pulsed note which addresses the held-at-zero failure mode. This claim addresses the OPPOSITE end of the speed curve: engaging brake at high speed creates large back-EMF currents through the low-side MOSFETs. The two claims together define the safe braking operating window.

Semantic neighbor: [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] — DISTINCT because existing note argues the low-speed failure mode (brake held after stop overheats FETs with no back-EMF); this claim argues the high-speed failure mode (brake engaged at full speed creates destructive braking current). Together they establish the braking window.

---

## Create

Created `knowledge/motor-speed-must-be-ramped-below-50-percent-before-activating-the-brake-because-high-speed-regenerative-braking-stresses-the-controller.md`. Frontmatter: type=claim, topics=[actuators, eda-fundamentals]. Body derives the back-EMF short-circuit current (~150A at full speed vs 75A at half speed through 0.2ohm phase winding), provides a brakeToStop() code pattern, and explains proxies for firmware without speed sensing. Wiki-linked to `[[dynamic-brake-must-be-pulsed-not-held...]]`, `[[stop-is-the-correct-emergency-kill...]]`, `[[bldc-direction-reversal-under-load...]]`, `[[zs-x11h-has-no-reverse-polarity...]]`. Ralph lead 2026-04-14.

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
