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

Created `knowledge/safe-bldc-startup-sequence-initializes-el-stopped-then-brake-engaged-then-enable-low-before-setting-any-active-state.md`. Frontmatter: type=claim, topics=[actuators, microcontrollers]. Body presents signal active/passive state table, full setup() code block with numbered comments, four rules (STOP first, brake before enable, interrupts last, never arm in setup), and generalizes to servos/steppers. Wiki-linked to `[[el-pin-floating-at-mcu-boot...]]`, `[[zs-x11h-el-speed-input...]]`, `[[bldc-stop-active-low-brake-active-high]]`, `[[stop-is-the-correct-emergency-kill...]]`. Ralph lead 2026-04-14.

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
