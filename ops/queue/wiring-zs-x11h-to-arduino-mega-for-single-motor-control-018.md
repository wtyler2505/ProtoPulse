---
claim: "Powering the MCU from the ZS-X11H 5V output causes resets because motor switching noise on the shared rail corrupts the logic supply"
classification: closed
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
semantic_neighbor: null
---

# Claim 018: Powering the MCU from the ZS-X11H 5V output causes resets because motor switching noise on the shared rail corrupts the logic supply

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 46, 220)

## Reduce Notes

Extracted from wiring-zs-x11h-to-arduino-mega-for-single-motor-control. This is a CLOSED claim.

Rationale: The source calls out in both the architecture paragraph and the Common Mistakes table that the ZS-X11H's onboard 5V output (tapped from the 78L05 regulator that powers its own logic and hall sensors) is noisy because it shares a rail with commutation switching. Using it to power an Arduino causes resets and erratic analog readings. The fix is a dedicated buck converter (LM2596) from the main battery. This is a discrete architectural rule that affects every ZS-X11H wiring decision — it is not captured anywhere in knowledge/, only the 78L05 failure-mode note touches the same regulator but from a different angle (failure mode, not clean-supply reasoning).

Semantic neighbor: None at this specificity. The [[78l05-regulator-failure-kills-hall-power-making-motor-appear-dead-when-only-the-regulator-failed]] note is adjacent but argues a different thing (failure mode of the regulator), not the rule against using it to power external MCUs.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
