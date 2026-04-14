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

**Discovery Trace:**
- Topic maps — target note has [[actuators]] and [[eda-fundamentals]] topics.
- Target note inline links verified: [[dynamic-brake-must-be-pulsed-not-held...]], [[stop-is-the-correct-emergency-kill...]], [[bldc-direction-reversal-under-load...]], [[zs-x11h-has-no-reverse-polarity...]] (enrich-015)
- Batch 2 sibling candidates: [[el-pin-floating-at-mcu-boot...]] (claim-017) and [[powering-the-mcu-from-the-zs-x11h-5v-output...]] (claim-018) — both are adjacent BLDC-init claims but operate on different subsystems (EL pin state / power supply). Not forced into this brake-specific claim. Skip.

**Connections verified:** 4 inline prose links + 2 topics. Articulation test PASS (pulsed-brake-note grounds the complementary low-speed failure; stop-vs-ct-brake grounds the operational distinction; reversal-under-load grounds the back-EMF math analogy; zs-x11h-no-protection grounds why the controller itself has no safety net).

**MOC updates:** [[actuators]] MOC has 85 entries — this braking rule belongs in a "braking" sub-cluster alongside pulsed-brake and stop-vs-ct-brake. Verify ordering at MOC polish.

**Agent note:** The pulsed-brake note handles low-speed failure (hold=overheat); this note handles high-speed failure (engage=back-EMF spike). Together they define a safe operating window: 0 < speed_at_brake_engage < 50%. Future synthesis candidate: a note named "safe-braking-window" that consolidates the rule pair into one lookup.

## Revisit
(to be filled by revisit phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
