---
description: "On a tank-steered rover, applying brake to the inner wheel while letting the outer wheel coast creates a pivot-like deceleration that tightens the turning radius during the stop — a dual-motor-specific braking strategy that trades straight-line stopping distance for tighter maneuvering at the cost of that motor's brake thermal budget"
type: claim
source: "docs/parts/wiring-dual-zs-x11h-for-hoverboard-robot.md"
confidence: high
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# asymmetric braking enables tighter turns during deceleration by braking the inner wheel while coasting the outer

Single-motor braking is a scalar: "how hard, for how long." Dual-motor braking is a strategy space. On a tank-steered rover, the brake signal is independently controllable per motor, which turns "stopping" into a motion-planning decision with four distinct modes:

| Scenario | Left motor | Right motor | Resulting motion |
|----------|-----------|-------------|------------------|
| Straight-line stop | Brake both | Brake both | Stops straight (if brake force matches) |
| Emergency stop | STOP both | STOP both | Both controllers disabled, motors coast |
| Controlled deceleration | Ramp PWM to 0, then brake | Ramp PWM to 0, then brake | Smoothest stop |
| Turn while braking | Brake inner wheel, coast outer | Coast or slow | Tighter turn during deceleration |

The "turn while braking" pattern matters because a tank-steered robot moving forward at speed cannot turn sharply without losing momentum — a pivot turn requires stopping first. But if the robot brakes the inner wheel hard while the outer wheel coasts, the asymmetric deceleration curves the path inward. The turning radius during deceleration is tighter than coasting would produce but less extreme than a full pivot, and the robot ends stopped and pointed in a new direction in one continuous motion.

This is a dual-motor-specific capability. A car-like robot with mechanical steering can apply differential braking (and ABS systems exploit this), but the coupling to a single drivetrain makes the effect modest. On a tank-steered rover where each wheel has its own independent motor and brake, the asymmetric braking is direct — brake force on one wheel becomes a turning torque because there is no drivetrain coupling to distribute it.

**The thermal cost:** The brake-heavy wheel absorbs all the combined rotational energy through its single set of MOSFETs. Since [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] already established that sustained braking is thermally risky, asymmetric braking concentrates that risk on one motor instead of splitting it. For short turns this is fine; for repeated use in rapid-maneuvering scenarios, the inner-wheel controller runs hotter than its counterpart and wears faster.

**Distinct from straight-line differential braking:** Even a "straight-line stop" requires equal brake force on both motors, and since load on each wheel is rarely identical (uneven weight distribution, one side on grip and the other slipping, battery sag asymmetry), straight-line stops actually deviate from straight. Asymmetric braking is the intentional version of that asymmetry.

**ProtoPulse implication:** When the bench coach generates a movement API for tank-steered rovers, it should expose `brakeAsymmetric(leftForce, rightForce)` alongside `brakeAll()` and `stopAll()`. Hiding the asymmetric option behind equal-force wrappers loses capability that the hardware already provides for free.

---

Source: [[wiring-dual-zs-x11h-for-hoverboard-robot]]

Relevant Notes:
- [[tank-steering-replaces-mechanical-steering-with-differential-wheel-speed-control]] — the control paradigm that makes asymmetric braking meaningful; without differential drive, asymmetric brake is just noise
- [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] — the thermal constraint that limits how aggressively asymmetric braking can be used
- [[h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate]] — the brake-vs-coast distinction that this note extends to the dual-motor case

Topics:
- [[actuators]]
- [[eda-fundamentals]]
