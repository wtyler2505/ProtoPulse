---
claim: "Safe BLDC startup sequence initializes EL stopped then brake engaged then enable LOW before setting any active state"
classification: closed
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
semantic_neighbor: null
---

# Claim 022: Safe BLDC startup sequence initializes EL stopped then brake engaged then enable LOW before setting any active state

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 110-119)

## Reduce Notes

Extracted from wiring-zs-x11h-to-arduino-mega-for-single-motor-control. This is a CLOSED claim.

Rationale: The Arduino setup() code embeds a generalizable startup sequence: `analogWrite(PIN_SPEED, 255)` (EL HIGH = stopped on active-low), `digitalWrite(PIN_DIR, LOW)` (forward default), `digitalWrite(PIN_BRAKE, LOW)` (brake engaged), `digitalWrite(PIN_ENABLE, LOW)` (disabled). This establishes the principle: configure every safety-relevant pin to its SAFE state BEFORE attaching interrupts or enabling the controller. This is a convention/pattern claim that applies beyond one code snippet — it defines the correct initialization order for any BLDC controller with enable/brake/speed/direction pins.

Semantic neighbor: None at this specificity. [[zs-x11h-el-speed-input-is-active-low]] covers one pin's polarity; this claim covers the MULTI-pin initialization ordering pattern that follows from having multiple safety-relevant signals.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
