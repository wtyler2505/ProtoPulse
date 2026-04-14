---
description: "Holding CT/BRAKE active after the motor stops shorts stationary motor phases through the low-side MOSFETs with no back-EMF to limit current -- brief braking pulses are safe but sustained hold risks thermal damage to the controller"
type: claim
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# dynamic brake must be pulsed not held because stationary phase shorting overheats MOSFETs

When the ZS-X11H's CT (brake) input is activated, the controller shorts all three motor phases together through the low-side MOSFETs. While the motor is spinning, this creates back-EMF braking -- the motor's own rotation generates current that opposes motion, decelerating the motor. The braking force is proportional to speed: strongest at high RPM, weakening as the motor slows. This is the intended use case.

However, once the motor has stopped or nearly stopped, there is no back-EMF to oppose current flow. The shorted phase windings become a low-resistance path from the supply through the MOSFETs. Without the motor's rotational energy being converted to heat in the windings (useful braking), the energy comes instead from the power supply and dissipates as heat in the MOSFETs themselves. On a controller with no thermal protection (which the ZS-X11H lacks), this sustained current draw can overheat and destroy the FETs.

**The safe braking pattern in firmware:**
1. Activate brake (CT LOW on ZS-X11H)
2. Monitor speed via SC pulse output or a timeout (e.g., 2 seconds)
3. Once motor speed drops below threshold or timeout expires, release brake (CT HIGH)
4. If the motor needs to be held in position, use mechanical braking, not electrical

**The anti-pattern:** Setting CT to brake and forgetting about it in the code. A `digitalWrite(BRAKE_PIN, LOW)` without a corresponding release is a time bomb -- it works fine during testing because the motor is spinning, but if the motor stalls or reaches zero speed while brake is held, heat builds silently.

This is distinct from the STOP function, which simply de-energizes the phases and lets the motor coast. STOP is safe to hold indefinitely because it does not create a current path.

---

Source: [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]

Relevant Notes:
- [[bldc-stop-active-low-brake-active-high]] -- the existing note on STOP vs BRAKE logic levels, which this note extends with the thermal failure mode
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] -- no thermal protection means the brake overheating scenario has no automatic safety net
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- dynamic braking is unique to BLDC and DC motors with H-bridges; servos and steppers hold position differently

Topics:
- [[actuators]]
- [[eda-fundamentals]]
