---
description: "Stepper motors like the 28BYJ-48 have no position feedback -- if the motor stalls (load exceeds torque), skips steps (acceleration too fast), or is manually displaced, the controller's position count diverges from reality with no indication of failure"
type: claim
source: "docs/parts/28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# open-loop steppers silently lose position on stall and have no recovery mechanism without external feedback

Stepper motors are open-loop by default. The controller sends N step pulses and assumes the motor moved N steps. There is no confirmation. If any of these conditions occur, the assumed position diverges from the actual position:

1. **Stall** -- load exceeds available torque at current speed. Motor stops but controller keeps counting.
2. **Step skipping** -- acceleration ramp exceeds motor's torque-speed curve. Motor can't keep up, drops steps randomly.
3. **External displacement** -- something physically moves the output shaft. Controller doesn't know.
4. **Resonance** -- at certain step rates, mechanical resonance can cause missed steps even within the torque envelope.

**The failure mode is silent.** Unlike a stalled DC motor (which draws more current, triggering overcurrent detection), a stalled stepper just... stops. The ULN2003 keeps switching coils, the motor stays magnetized at one position, and the software happily increments its step counter. There is no electrical signal indicating the problem.

**Recovery options (in order of complexity):**
- **Home switch** -- a microswitch or optical sensor at a known position. On startup or after suspected loss, move until the switch triggers. Simple but only gives you one known position.
- **Encoder on output shaft** -- a rotary encoder provides continuous position feedback. Turns open-loop into closed-loop but adds cost and wiring complexity. Overkill for most 28BYJ-48 applications.
- **Design around it** -- reduce load, increase margins, add acceleration ramps, avoid resonance zones. If you never stall, you never lose position.

**For the 28BYJ-48 specifically:** The 1:64 gear reduction actually helps here. The gear train provides a mechanical advantage that makes stalling much harder at the output shaft (the motor has far more torque than the flimsy plastic gear train would suggest). But it also means that if external force IS applied to the output shaft, the gears resist backdrive -- you're more likely to strip a gear than displace the motor.

**ProtoPulse implication:** When a stepper motor is in the BOM without any encoder or limit switch, the AI tools should flag this as an open-loop design. Not necessarily an error, but a design choice the user should consciously acknowledge. For critical positioning applications, the system should suggest adding a homing mechanism.

---

Source: [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]]

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- steppers are step-counted, not feedback-controlled; this is the fundamental difference from servos and closed-loop BLDC
- [[sc-speed-pulse-output-enables-closed-loop-rpm-measurement-via-interrupt-counting]] -- BLDC controllers CAN have feedback via speed pulse; steppers have no equivalent built-in signal

Topics:
- [[actuators]]
- [[eda-fundamentals]]
