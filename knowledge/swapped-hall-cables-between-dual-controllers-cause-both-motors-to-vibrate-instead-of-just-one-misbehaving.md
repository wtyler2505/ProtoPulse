---
description: "In a dual-motor build, each Hall sensor cable must route to its own motor's controller — if the cables are swapped so the left motor's Halls feed the right controller and vice versa, BOTH motors vibrate because each controller commutates based on the wrong rotor's position, a failure signature that looks like two separate problems but is actually one crossed-wiring mistake"
type: claim
source: "docs/parts/wiring-dual-zs-x11h-for-hoverboard-robot.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[wiring-integration]]"
  - "[[eda-fundamentals]]"
---

# swapped hall cables between dual controllers cause both motors to vibrate instead of just one misbehaving

A single-motor BLDC system has one diagnostic advantage over dual-motor systems: if the motor misbehaves, the problem is obviously in that one motor's wiring. Dual-motor systems lose that isolation. When two ZS-X11H controllers sit side-by-side driving two hoverboard hub motors, the Hall sensor cables are physically identical — same connector, same pinout, same color coding. Crossing them during assembly produces a failure mode that is hard to diagnose because the symptom is symmetric: both motors vibrate instead of rotating smoothly.

**Why both motors fail, not just one:** Each ZS-X11H uses Hall sensor feedback to determine which phase pair to energize for smooth commutation (per [[bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation]]). When the left controller's motor phases (which drive the left motor) are driven by the right motor's Hall signals, the commutation timing has zero correlation with the left rotor's actual position. The controller energizes phase A while the rotor is in a position that calls for phase B or C, producing a pulsed torque in random directions. The net effect is vibration, not rotation. The same thing happens on the right side for the same reason. Two motors, two identical symptoms, one root cause.

**Why it is easy to make this mistake:** The Hall cables exit from the motors and run toward the controllers. In a chassis where the controllers are mounted in a row (or stacked), the shortest cable route from "left motor" may physically reach the "right controller" first, especially if cable lengths differ or if the chassis layout was designed after the controllers were mounted. The connectors mate. Nothing looks wrong until power-on.

**The prevention:** Label each Hall cable with its motor of origin before routing. Mark the "left motor" cable with a red band and the "right motor" cable with a blue band (or any two distinguishable markings). Match the colored band to a corresponding label on the target controller before connecting. This turns a silent failure mode into a visible mismatch.

**The diagnostic signature:**
- Both motors vibrate instead of rotating -> check Hall cable routing FIRST (before suspecting bad controllers or bad Hall sensors)
- Only one motor vibrates -> likely a single-motor issue (bad Hall sensor, wrong phase wire permutation, miswired Hall pins)
- Both motors run smoothly but in wrong directions -> this is the mirrored-chassis problem, not a Hall cable swap

**Why this is distinct from [[hall-sensor-wiring-order-matters-for-bldc]]:** That note covers Hall pin ordering within a single cable (VCC/GND/H1/H2/H3 sequence matters). This note covers cable destination in a multi-motor system (which cable goes to which controller matters). Both are wiring errors, but the diagnostic steps and the mental model differ.

**ProtoPulse implication:** The bench coach's multi-motor checklist should include "Hall cable labeling" as a mandatory pre-power-on step for any design with more than one BLDC controller. The DRC cannot detect this error from the schematic (the schematic shows correct routing; the mistake is physical assembly), so the mitigation is workflow, not software validation.

---

Source: [[wiring-dual-zs-x11h-for-hoverboard-robot]]

Relevant Notes:
- [[bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation]] — the commutation dependency that makes Hall signal routing load-bearing
- [[hall-sensor-wiring-order-matters-for-bldc]] — the single-cable version of the same class of wiring error
- [[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]] — the underlying Hall signal format whose integrity this note depends on
- [[opposite-facing-chassis-motors-require-software-or-phase-wire-inversion-to-make-forward-produce-same-direction-wheel-motion]] — a different dual-motor wiring gotcha with a different diagnostic signature

Topics:
- [[actuators]]
- [[wiring-integration]]
- [[eda-fundamentals]]
