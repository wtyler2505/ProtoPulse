---
description: "The 1:64 gear ratio produces 2048 steps/rev (0.18 degree resolution) but caps output speed at ~15 RPM -- this is a hard architectural trade-off where you gain sub-degree precision but lose the ability to do anything requiring fast rotation"
type: claim
source: "docs/parts/28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# 28byj-48 gear reduction trades speed for precision at a ratio that eliminates most dynamic applications

The 28BYJ-48's 1:64 gear reduction is the defining architectural choice of this motor. The raw stepper has a 5.625 degree step angle, but the gear train multiplies resolution by 64x, yielding 2048 steps per output revolution in half-step mode (4096 with the gear ratio factored in). That's 0.088 degree resolution at the output shaft -- sub-degree precision from a $2 motor.

The cost is speed. The gear train divides output RPM by the same 64x factor. Even with the input shaft spinning as fast as the coil switching allows, the output tops out around 15 RPM. This isn't a limitation you can engineer around -- it's baked into the gear ratio. You cannot get both high resolution and high speed from a geared stepper without changing the gear ratio, which means changing the motor.

**What 15 RPM is good for:**
- Pointer dials, gauge indicators
- Camera pan mechanisms (time-lapse sliders)
- Rotary platform positioning
- Valve actuators
- Antenna rotators (small)

**What 15 RPM is NOT good for:**
- Wheel drive (even at small scale)
- Fan or propeller rotation
- Anything requiring continuous rotation at meaningful speed
- Real-time tracking of fast-moving objects

**The selection heuristic:** If your application needs sub-degree positioning and doesn't care about speed, the 28BYJ-48 is nearly perfect for the price point. If you need speed OR torque (even moderate), you need a NEMA17 bipolar stepper with a proper driver (A4988/DRV8825) or a DC motor with encoder feedback.

Since [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]], the 28BYJ-48 is still a stepper (pulse = step), but its effective control space is dramatically different from an ungeared NEMA17. The gear ratio constrains the acceleration profile and maximum step rate in ways that affect code, not just mechanical design.

---

Source: [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]]

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- the step+direction paradigm is shared with NEMA17 but the practical control envelope is radically different due to gearing
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- 28BYJ-48 needs Darlington sink (ULN2003), not an H-bridge or bipolar stepper driver
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] -- 28BYJ-48 sits at the bottom tier (HW-130/L293D shield)

Topics:
- [[actuators]]
- [[eda-fundamentals]]
