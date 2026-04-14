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

Created `knowledge/powering-the-mcu-from-the-zs-x11h-5v-output-causes-resets-because-motor-switching-noise-on-the-shared-rail-corrupts-the-logic-supply.md`. Frontmatter: type=claim, source=wiring-zs-x11h-to-arduino-mega, topics=[actuators, power-systems, microcontrollers]. Body explains the 78L05 sharing with commutation logic, 100mA current limit, the two characteristic symptoms (brownout resets + ADC jitter), and the LM2596 architectural fix. Wiki-linked to `[[78l05-regulator-failure...]]`, `[[bldc-controller-and-mcu-must-share-common-ground...]]`, `[[10uf-ceramic-on-esp32-vin...]]`, `[[100uf-capacitor-on-arduino-5v-input...]]`, `[[lm2596-adjustable-buck-converter...]]`. Ralph lead 2026-04-14.

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
