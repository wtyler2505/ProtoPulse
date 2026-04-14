---
description: "At 2A the L298N drops 4.9V across its output transistors -- a 12V motor effectively gets ~7V, losing 40% of supply voltage as heat. MOSFET-based drivers like the TB6612 have millivolt-level drops"
type: claim
source: "docs/parts/l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# l298n saturation voltage drop loses up to 5v making it inefficient at high current

The L298N uses bipolar Darlington transistors in its H-bridge, not MOSFETs. Each transistor pair has a collector-emitter saturation voltage, and since the H-bridge has two transistors in the current path (high-side and low-side), the total drop is the sum of both. At 1A this totals 1.8V; at 2A it reaches 4.9V.

This means a 12V motor supply delivers only ~7V to the motor at 2A -- a 40% voltage loss dissipated entirely as heat in the driver IC. The thermal consequences are severe: at 2A per channel with 4.9V drop, the chip dissipates ~10W per channel, quickly exceeding the 25W package limit without adequate heatsinking.

**The same penalty applies at lower currents with lower-voltage supplies.** A 6V motor supply at 1A delivers only ~4V to the motor through an L298N shield — still a 33% loss. Beginners wiring the OSEPP Motor/Servo Shield V1 for a small robot often use a 6V battery pack assuming a 6V motor will run at 6V; in practice the motor sees 4V and the robot is noticeably sluggish. The remedy is to size the supply voltage at motor voltage plus drop-at-expected-current, not to match nominal motor voltage to nominal supply voltage.

This is the fundamental reason the L298N is considered a legacy part. Modern MOSFET-based H-bridge drivers like the TB6612FNG achieve RDS(on) in the milliohm range, dropping only tens of millivolts under equivalent loads. The TB6612 at 1.2A drops approximately 0.5V total -- an order of magnitude improvement.

**Practical implication for beginners:** If a motor runs noticeably slower on an L298N than expected from the supply voltage, the saturation drop is the likely cause. The fix is not to increase supply voltage (which adds more heat) but to switch to a MOSFET-based driver. Since [[motor-shield-current-ratings-form-a-graduated-selection-ladder]], the OSEPP TB6612 shield is the better choice for motors under 1.2A, and the L298N only makes sense when the 1.2A limit is genuinely too low.

**ProtoPulse implication:** The BOM validation tools should flag L298N usage at currents above 1A with a warning about efficiency loss, and suggest MOSFET alternatives when the motor's current draw is within TB6612 range.

---

Source: [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]

Relevant Notes:
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] -- L298N sits at the 2A tier; this note explains why the tier below (TB6612) is often better
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- the mid-power tier (5-46V) is where saturation drop hits hardest
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- even when the L298N is the right architecture, efficiency still matters
- [[combo-motor-and-servo-shields-trade-per-function-efficiency-for-single-board-convenience]] -- combo shields inherit the L298N saturation penalty because the driver IC is locked in by the form factor

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
