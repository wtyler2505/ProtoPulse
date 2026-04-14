---
description: "STOP LOW disables the ZS-X11H's commutation logic and de-energizes all three motor phases, letting the rotor coast freely; CT LOW shorts the phases through the low-side MOSFETs to convert kinetic energy into heat — only STOP removes the controller from the power path, which is why STOP is the emergency-kill and CT is reserved for controlled deceleration within a commanded speed profile"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
related_components:
  - "riorand-zs-x11h"
---

# STOP is the correct emergency kill and CT brake is for controlled deceleration because only STOP removes the controller power path entirely

The ZS-X11H exposes two superficially similar signals that both make the motor slow down, but they do it by opposite mechanisms. Understanding which one to use in which situation is the difference between a reliable emergency-stop path and a controller that burns out on its first panic shutdown.

**STOP LOW disables the commutation logic entirely.** The controller stops driving its gate-driver outputs, all six MOSFETs in the bridge turn OFF, and the motor phases are electrically isolated. The rotor coasts — its kinetic energy dissipates through friction over whatever distance the load takes to decelerate naturally. No current flows through the MOSFETs; no heat accumulates in the controller. The motor can be manually rotated freely because its windings are open-circuit at the controller end.

**CT LOW engages dynamic braking by shorting the phases.** The controller switches all three low-side MOSFETs ON simultaneously, creating a three-way short across the motor windings. The rotor's back-EMF now drives current through those shorted windings, and that current flows backward through the low-side MOSFETs. The current magnitude is set by the back-EMF and the winding resistance — at full speed it can reach [[motor-speed-must-be-ramped-below-50-percent-before-activating-the-brake-because-high-speed-regenerative-braking-stresses-the-controller|roughly 150A through the low-side FETs]], well above their rated continuous current. The energy that was stored in the rotor's angular momentum ends up as heat in the FETs.

The consequence of confusing the two is concrete. Using CT as an emergency stop at full speed forces the controller to absorb the full kinetic energy of the motor through its MOSFETs in a brief, high-current burst. The FETs survive once or twice; they degrade a little on each event, and eventually they fail — often during the very emergency the stop was meant to handle. Using STOP lets the motor coast, trading stopping distance for controller survival. In a rover about to collide with an obstacle, losing two meters of stopping distance is acceptable; losing a working motor controller is not.

The role hierarchy falls out of this mechanism distinction:

| Situation | Correct signal | Why |
|-----------|----------------|-----|
| Planned deceleration within a speed profile | CT brake (below 50% speed) | Precise, bounded energy in FETs, controlled final position |
| End of a commanded trajectory (come to stop) | CT brake pulsed, then STOP | Brake to near-zero, then STOP to prevent [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets|held-brake heating]] |
| User-commanded emergency stop (panic button) | STOP | Unknown motor state, unknown speed, protect the controller |
| E-stop mushroom from safety circuit | STOP + main-bus contactor open | [[estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal\|firmware-aware]] redundant path |
| Fault detected in firmware (current spike, comm loss) | STOP | Remove controller from power path before diagnosing |

The signal polarity follows the pattern [[bldc-stop-active-low-brake-active-high|STOP active-LOW, brake active-HIGH]]  — the reset state of both pins pulled LOW fails into "STOP engaged, brake released." A wire falling off either pin defaults to motor disabled, which is the safe direction for both signals.

For ProtoPulse schematic validation, the DRC should flag any design that routes the emergency-stop input to CT instead of STOP. This is a common beginner mistake because "brake" sounds like the more stopping-ish signal; the naming conflicts with what each signal actually does inside the controller.

---

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]]

Relevant Notes:
- [[motor-speed-must-be-ramped-below-50-percent-before-activating-the-brake-because-high-speed-regenerative-braking-stresses-the-controller]] — why CT at full speed is unsafe even when stopping is the goal
- [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] — why CT cannot substitute for STOP at zero speed either
- [[bldc-stop-active-low-brake-active-high]] — the polarity convention both signals follow
- [[estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal]] — the firmware-aware E-stop path that drives STOP as part of a redundant scheme
- [[emergency-stop-via-stop-pin-low-disables-bldc-controllers-entirely-and-is-safer-than-regenerative-braking-for-fault-conditions]] — the general BLDC principle this claim specializes to ZS-X11H

Topics:
- [[actuators]]
- [[eda-fundamentals]]
