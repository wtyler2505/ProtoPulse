---
claim: "CT brake polarity on the ZS-X11H is active-low contradicting the KJL-01 claim that brake is active-high suggesting the polarity is vendor-specific not a BLDC convention"
classification: open
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
type: tension
semantic_neighbor: "bldc-stop-active-low-brake-active-high"
---

# Claim 024: CT brake polarity on the ZS-X11H is active-low contradicting the KJL-01 claim that brake is active-high suggesting the polarity is vendor-specific not a BLDC convention

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 21, 67-69)

## Reduce Notes

Extracted from wiring-zs-x11h-to-arduino-mega-for-single-motor-control. This is an OPEN claim — a TENSION.

Rationale: The source explicitly states for the ZS-X11H: "CT (brake): LOW = brake engaged, HIGH = free run" and "digitalWrite(7, LOW) = Brake engaged (motor actively resists rotation)". But the existing knowledge note [[bldc-stop-active-low-brake-active-high]] sourced from the RioRand KJL-01 claims BRAKE is ACTIVE-HIGH. The RioRand part record treats ZS-X11H and KJL-01 as closely related controllers. This contradiction is worth capturing as a tension because (a) it may indicate the existing note is over-generalizing from one controller to a family, (b) it may indicate the two controllers genuinely use opposite conventions and bench coach must check per-controller, (c) it has real safety implications because a beginner applying the KJL-01 rule to a ZS-X11H will hold the brake permanently engaged.

Semantic neighbor: [[bldc-stop-active-low-brake-active-high]] — CONTRADICTS on brake polarity specifically. The STOP polarity agrees (both active-low) but BRAKE polarity disagrees (ZS-X11H active-low, KJL-01 active-high per existing note).

Resolution path: During reflect phase, verify the ZS-X11H part datasheet, verify the KJL-01 part datasheet, and either (a) update the existing note to be ZS-X11H-specific or KJL-01-specific, or (b) split into two notes per controller, or (c) create a tension note in ops/tensions/ that survives as a known-unresolved-fact.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
