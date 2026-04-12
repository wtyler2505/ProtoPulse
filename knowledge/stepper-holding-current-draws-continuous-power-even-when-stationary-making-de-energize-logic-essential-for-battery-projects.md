---
description: "A stepper motor draws its rated current (240mA for 28BYJ-48) continuously while holding position -- unlike a DC motor which draws zero current at rest -- so battery-powered stepper projects must implement explicit coil de-energize logic when movement is complete"
type: claim
source: "docs/parts/28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# stepper holding current draws continuous power even when stationary making de-energize logic essential for battery projects

When a stepper motor reaches its target position, the coils remain energized to hold that position against external forces. This is "holding torque" -- the motor actively resists being moved. But it costs continuous current draw identical to what the motor uses during motion.

For the 28BYJ-48, this means ~240mA drawn continuously even when the motor hasn't moved in hours. On a 2000mAh battery pack, holding position alone would drain the battery in about 8 hours -- without ever moving.

**The power calculation:**
- 240mA at 5V = 1.2W continuous
- Over 8 hours = 9.6Wh consumed doing nothing
- A 4xAA NiMH pack (4.8V, 2000mAh) = 9.6Wh total capacity

**The solution: de-energize coils after movement completes.**

In AccelStepper, call `stepper.disableOutputs()` after reaching the target position. This drives all output pins LOW, de-energizing all coils. The motor is now free to be turned by external force -- but for many applications (pointer dials, camera sliders, valve positions), nothing is pushing against it.

**The trade-off is explicit:**
- Energized: position is held against external force, continuous power draw
- De-energized: zero power, but position is maintained only by friction and gravity

**When to keep coils energized:**
- Load is actively pushing against the motor (gravity on a vertical mechanism)
- Precision matters and any displacement is unacceptable
- Power source is not battery-limited (wall adapter)

**When to de-energize:**
- Horizontal mechanism with no opposing force
- Battery-powered project where idle current matters
- Motor only moves occasionally (valve position set once per hour)

**ProtoPulse implication:** The power analysis tools should flag stepper motors in battery-powered projects and calculate worst-case holding current drain. If a stepper's holding current exceeds 10% of available battery capacity per hour, the system should suggest implementing de-energize logic.

---

Source: [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]]

Relevant Notes:
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- the 28BYJ-48 sits in the servo-level tier; holding current considerations apply to all steppers in this tier
- [[28byj-48-gear-reduction-trades-speed-for-precision-at-a-ratio-that-eliminates-most-dynamic-applications]] -- the gear train resists backdrive, making de-energize safer than on an ungeared motor

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
