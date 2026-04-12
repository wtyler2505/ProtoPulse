---
description: "The outrunner BLDC architecture spins the outer shell (and tire) around a fixed stator, eliminating gearboxes, belts, and external moving parts -- quiet, reliable, and mechanically simple"
type: claim
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# outrunner hub motors eliminate mechanical transmission by making the wheel the rotor

A hoverboard hub motor is an outrunner-style BLDC: the outer shell (which includes the tire and wheel) IS the rotor, spinning around a fixed stator bolted to the axle. This inverts the typical motor topology where an inner rotor spins inside a fixed case. The consequence is that there is no gearbox, no belt, no chain, no external moving parts beyond the wheel itself. The motor and the wheel are one unit.

This matters for project planning because it eliminates an entire category of mechanical complexity. A rover using hub motors has no drivetrain to design, no gear reduction to calculate, no belt tension to maintain. The tradeoff is that you lose the ability to gear down for more torque -- whatever torque the motor produces at its operating voltage is what you get at the wheel. For hoverboard motors (~250W, 36V, ~15 pole pairs), this yields approximately 200-300 RPM no-load with a KV rating of ~8-10 RPM/V.

The outrunner design also means the magnets are on the outside of the air gap, which allows for more magnet surface area in a given diameter. This is why hub motors can produce useful torque despite relatively low RPM -- they compensate with a large number of pole pairs (typically 15, meaning 30 magnets) arranged around a large-diameter rotor.

For ProtoPulse, when a user adds a "hub motor" to their architecture, the system should understand that no mechanical transmission components are needed between the motor and the wheel -- they are the same object. This simplifies the BOM and wiring diagram but constrains the speed/torque envelope to what the motor provides directly.

---

Source: [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- BLDC commutation is one of the five paradigms, and outrunners add the mechanical dimension
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- hub motors need 3-phase bridge controllers, not H-bridges
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] -- the RioRand ZS-X11H at the top of the ladder is the matched controller for these motors

Topics:
- [[actuators]]
- [[eda-fundamentals]]
