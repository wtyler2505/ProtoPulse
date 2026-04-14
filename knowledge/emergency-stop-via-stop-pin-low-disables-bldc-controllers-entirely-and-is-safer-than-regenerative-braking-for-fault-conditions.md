---
description: "Pulling STOP LOW disables the ZS-X11H output stage with no current flowing through the motor — unlike brake LOW which shorts motor phases through MOSFETs and dissipates back-EMF as heat — making STOP the correct emergency-stop primitive and brake the correct deceleration primitive"
type: claim
source: "docs/parts/wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# emergency stop via STOP pin LOW disables BLDC controllers entirely and is safer than regenerative braking for fault conditions

The ZS-X11H exposes two distinct stop primitives that beginners conflate: the STOP pin and the CT (brake) pin. They produce different internal states and have different safety properties, and picking the wrong one for an emergency stop condition is a thermal hazard at 4-motor scale.

Pulling **STOP LOW** disables the controller's output stage entirely. No PWM drives to the motor phases, no regenerative current flows, and the motor coasts to a stop under friction alone. The controller draws only its own quiescent current. This is what you want when something has gone wrong — a fault, a crash, a software panic — because it removes the controller from the active-current path completely. Combined with [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]], STOP LOW on all four controllers simultaneously is also the gentlest possible shutdown from the battery's perspective.

Pulling **CT (brake) LOW** engages regenerative braking by shorting the motor phases through the low-side MOSFETs. The motor's back-EMF drives current through those MOSFETs, dissipating kinetic energy as heat in the silicon. At 4WD scale (four motors, each at 15A peak), this is ~60A of back-EMF current dumped into eight MOSFETs for the duration of the stop. Since [[speed-must-be-reduced-before-braking-at-high-voltage-because-back-emf-dissipation-in-mosfets-scales-with-rpm]], engaging brake at high speed without ramping PWM down first risks MOSFET thermal failure. That thermal cost is acceptable for deliberate deceleration but unacceptable as a fault response, because the conditions that trigger a fault are correlated with the conditions that make dumping 60A into the MOSFETs worst — high speed, obstacle impact, loss of control.

Therefore the correct emergency stop sequence is: STOP LOW on all controllers FIRST (removes the controllers from the current path), THEN if extra deceleration is needed, CT LOW as a secondary action after verifying the vehicle has decelerated enough to make regenerative dump safe. Inverting this order makes the emergency response itself a thermal event.

The firmware distinction this forces: emergencyStop() and decelerateAndBrake() are different functions, not the same function at different thresholds.

---

Source: [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]]

Relevant Notes:
- [[bldc-stop-active-low-brake-active-high]] — the base logic-level convention these primitives rely on
- [[speed-must-be-reduced-before-braking-at-high-voltage-because-back-emf-dissipation-in-mosfets-scales-with-rpm]] — why brake at high RPM is a thermal hazard
- [[h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate]] — same confusion at a different motor-controller class
- [[two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption]] — the hardware layer above this firmware-layer choice
- [[estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal]] — how hardware e-stop and firmware e-stop coordinate

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
