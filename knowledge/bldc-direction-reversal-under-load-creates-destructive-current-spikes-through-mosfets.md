---
description: "Toggling Z/F while the motor is spinning reverses the commutation sequence against the rotor's momentum, creating back-EMF-additive current spikes that can exceed the 20A peak MOSFET rating and destroy the controller"
type: claim
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
  - "[[breadboard-intelligence]]"
---

# BLDC direction reversal under load creates destructive current spikes through MOSFETs

When the ZS-X11H's Z/F (direction) pin is toggled while the motor is spinning, the controller immediately reverses its commutation sequence. But the motor's rotor has angular momentum and continues spinning in the original direction. The controller is now driving phases against the rotor's motion, which means the supply voltage and the motor's back-EMF are additive rather than opposing. The resulting current spike can be several times the normal operating current.

For a motor running at 15A under normal load, a sudden reversal can produce instantaneous current well above the 20A peak rating of the ZS-X11H's MOSFETs. Since the controller has no overcurrent protection, the FETs absorb the full spike. Even if they survive one reversal, repeated stress degrades the silicon and shortens the controller's life.

**The safe direction change sequence:**
1. Ramp EL to stop: `analogWrite(EL_PIN, 0)` (constant HIGH = motor deceleration)
2. Wait for motor to actually stop -- either monitor SC pulses until frequency drops to zero, or use a conservative timeout (1-3 seconds depending on load inertia)
3. Toggle Z/F direction pin
4. Ramp EL back up gradually: increment from 0 toward target speed over 500ms-2s

**The mechanical alternative:** If "forward" spins the wrong way from the start, don't toggle Z/F in software -- swap any two motor phase wires (MA/MB, MB/MC, or MA/MC) at the physical connection. This changes the permanent rotation direction without requiring runtime direction changes.

**ProtoPulse implication:** The bench coach should enforce a sequencing rule in generated Arduino code: any `setDirection()` function must include a stop-wait-change-ramp sequence. Direct `digitalWrite(DIR_PIN, !currentDir)` without stopping first should be flagged as a DRC error, not a warning, because the consequence is hardware destruction.

---

Source: [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md]]

Relevant Notes:
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] -- no overcurrent protection means the current spike from reversal has no automatic limit
- [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]] -- the EL stop value is analogWrite(0) = HIGH = stop, which is counterintuitive during the stop-reverse sequence
- [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] -- brake can be used for faster deceleration before direction change, but must be released before reversal

Topics:
- [[actuators]]
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
