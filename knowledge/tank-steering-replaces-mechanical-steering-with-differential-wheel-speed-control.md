---
description: "Forward, reverse, pivot turns, arc turns, and spin-in-place all emerge from varying independent motor speeds — no steering linkage, servo, or Ackermann geometry is needed because the motion primitive is speed difference rather than wheel angle"
type: claim
source: "docs/parts/wiring-dual-zs-x11h-for-hoverboard-robot.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[wiring-integration]]"
  - "[[eda-fundamentals]]"
related_components:
  - "riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input"
  - "hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors"
---

# tank steering replaces mechanical steering with differential wheel speed control

Tank steering (also called skid-steer or differential drive) is the control paradigm where a robot's direction of travel is determined entirely by the relative speeds of its left and right drive wheels. There is no steering mechanism — no servo-driven wheel angle, no rack-and-pinion, no Ackermann geometry. The motion primitive is "set left speed X, set right speed Y" and everything else emerges from that.

This matters because it inverts the mechanical complexity budget. A car-like robot with Ackermann steering needs a drivable steering linkage, a turning servo or stepper, a calibration procedure for wheel angles, and firmware that maps desired curvature to steering angle and throttle. A tank-steered robot needs two independent motor controllers and a table that maps desired motion to a pair of speed values:

| Desired motion | Left motor | Right motor |
|----------------|-----------|-------------|
| Forward | Forward, speed X | Forward, speed X |
| Reverse | Reverse, speed X | Reverse, speed X |
| Pivot left | Reverse, speed X | Forward, speed X |
| Pivot right | Forward, speed X | Reverse, speed X |
| Arc left | Forward, speed X/2 | Forward, speed X |
| Spin in place | Forward, speed X | Reverse, speed X |

The trade-off is terrain friction and wheel scrubbing — tank steering turns by dragging wheels sideways, which wears tires and struggles on high-friction surfaces like carpet. But for hoverboard hub motors on hard floors or packed earth, the elimination of steering hardware is a net win. Since [[outrunner-hub-motors-eliminate-mechanical-transmission-by-making-the-wheel-the-rotor]] already removed the drivetrain, tank steering removes the remaining mechanical linkage — the result is a rover with exactly two moving parts (the wheels) and a pure-software control surface.

**ProtoPulse implication:** When the bench coach detects two BLDC controllers driving hub motors without a steering servo, it should recognize the tank-steering pattern and scaffold a `driveForward / driveReverse / turnLeft / turnRight / arcLeft / arcRight` API rather than generic `setMotor1 / setMotor2` functions. The right abstraction layer is the motion primitive, not the actuator.

---

Source: [[wiring-dual-zs-x11h-for-hoverboard-robot]]

Relevant Notes:
- [[outrunner-hub-motors-eliminate-mechanical-transmission-by-making-the-wheel-the-rotor]] — tank steering extends the "fewer moving parts" logic one step further by eliminating steering too
- [[opposite-facing-chassis-motors-require-software-or-phase-wire-inversion-to-make-forward-produce-same-direction-wheel-motion]] — the mirrored-motor problem that tank steering inherits and must solve
- [[asymmetric-braking-enables-tighter-turns-during-deceleration-by-braking-the-inner-wheel-while-coasting-the-outer]] — braking strategy specific to tank-steered platforms
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] — 4WD tank steering is just dual-motor tank steering scaled up, with the same control primitives

Topics:
- [[actuators]]
- [[wiring-integration]]
- [[eda-fundamentals]]
