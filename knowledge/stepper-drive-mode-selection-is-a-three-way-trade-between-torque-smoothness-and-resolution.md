---
description: "Full step wave drive gives least torque but simplest code, full step two-phase gives maximum torque but is choppy, and half-step doubles resolution with moderate torque -- the choice is application-driven, not one-size-fits-all"
type: claim
source: "docs/parts/28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# stepper drive mode selection is a three-way trade between torque smoothness and resolution

A unipolar stepper like the 28BYJ-48 can be driven in three fundamentally different modes, each trading between torque, smoothness, and resolution. This is NOT just a code configuration -- it changes the motor's mechanical behavior.

**The three modes:**

| Mode | Coils Energized | Steps/Rev | Step Angle | Torque | Smoothness |
|------|-----------------|-----------|-----------|--------|------------|
| Wave drive (full step) | 1 at a time | 2048 | 5.625 deg | Lowest (~50% of rated) | Choppy |
| Two-phase (full step) | 2 at a time | 2048 | 5.625 deg | Highest (rated torque) | Moderate |
| Half step | Alternates 1 and 2 | 4096 | 2.8125 deg | Moderate (~70% of rated) | Smoothest |

**Why wave drive exists:** It uses the least power (one coil energized at a time = half the current draw of two-phase). For battery-powered applications where torque requirements are well within margin, wave drive extends battery life. But the rotor snaps between positions with less holding force between steps, producing visible judder at low speeds.

**Why two-phase is the torque champion:** With two adjacent coils energized simultaneously, the magnetic field is stronger and the rotor is pulled into position by two force vectors. This gives maximum holding torque and maximum dynamic torque, but at the cost of drawing full current from both coils continuously.

**Why half-step is the default recommendation:** It interleaves single-coil and dual-coil states, doubling the step count (4096 steps/rev with the 28BYJ-48's gear train). The resolution doubles, motion is visibly smoother, and torque is adequate for most hobby applications. AccelStepper's `HALFSTEP = 8` mode implements this.

**The code implication:** AccelStepper's constructor `type` parameter selects the mode:
- `FULL4WIRE = 4` -- two-phase full step
- `HALF4WIRE = 8` -- half step (recommended default)
- Wave drive requires custom step sequences (not a built-in AccelStepper mode)

Since [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]], these modes are specific to stepper motors. DC motors have no analogous mode selection -- their speed/torque curve is continuous, not discrete.

---

Source: [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]]

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- drive modes are a sub-paradigm within the stepper control paradigm
- [[28byj-48-gear-reduction-trades-speed-for-precision-at-a-ratio-that-eliminates-most-dynamic-applications]] -- gear ratio multiplies step count; half-step + 1:64 gear = 4096 effective steps/rev

Topics:
- [[actuators]]
- [[eda-fundamentals]]
