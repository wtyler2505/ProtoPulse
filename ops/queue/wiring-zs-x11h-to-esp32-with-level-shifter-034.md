---
claim: "Level shifter HV reference must come from a clean regulated supply not from the motor controller 5V rail because motor switching noise on the shared rail produces erratic level shifting"
classification: closed
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
semantic_neighbor: "parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators"
---

# Claim 034: Level shifter HV reference must come from a clean regulated supply not from the motor controller 5V rail because motor switching noise on the shared rail produces erratic level shifting

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (line 288)

## Reduce Notes

Extracted from wiring-zs-x11h-to-esp32-with-level-shifter. This is a CLOSED claim.

Rationale: The vault covers the inverse case — powering the MCU from the motor controller's 5V rail causes resets (claim-018). This is a distinct failure mode: using the motor controller's noisy 5V as the level shifter's HV reference shifts the shifter's threshold by whatever noise is on the rail, producing intermittent misrecognition of 3.3V→5V translations. The fix routes the shifter HV from the same LM2596 that powers the MCU (clean 5V), keeping the shifter's voltage reference independent of motor switching events. This is level-shifter-specific and doesn't appear in the existing power or level-shifter notes.

Semantic neighbor: parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators (RELATED but DISTINCT — that note covers regulator cascading; this covers reference rail sharing for level-shifters specifically).

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
