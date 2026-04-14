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

**Discovery Trace:**
- Topic maps — target note has [[actuators]], [[power-systems]], [[microcontrollers]] topic footers. Multi-MOC membership.
- Target note inline links verified: [[78l05-regulator-failure...]], [[bldc-controller-and-mcu-must-share-common-ground...]], [[10uf-ceramic-on-esp32-vin...]] (claim-004, WiFi burst response — this is the DIRECT sibling link), [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi...]], [[lm2596-adjustable-buck-converter-module-3a-step-down]]
- Strong sibling hit: Note already links to [[10uf-ceramic-on-esp32-vin...]] (claim-004) with articulation "burst-response reservoir" — bidirectional connection established.

**Connections verified:** 5+ inline prose links + 3 topic MOCs. Articulation test PASS (78L05 grounds the regulator's architecture; common-ground grounds the wiring discipline; ESP32-10uF and Arduino-100uF ground the parallel mitigation pattern; LM2596 grounds the hardware fix).

**MOC updates:** Note spans 3 MOCs (actuators, power-systems, microcontrollers) — a strong cross-cutting rule. Verify all three list it at next MOC polish.

**Agent note:** This note grounds a common beginner mistake: "the driver has 5V output, why not use it?" The answer is architectural (shared rail with switching) not specific (specific cap, specific regulator) — so the note stays valuable even if the specific parts change. Pairs with power-budget-hierarchy as an example of "isolation prevents cascading failures."

## Revisit
(to be filled by revisit phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
