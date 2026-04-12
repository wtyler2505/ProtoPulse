---
description: "EL pin at 0% duty cycle = FULL SPEED, 100% = stop in PWM mode, but in analog mode 0V = stop and 5V = full speed -- the polarity inverts depending on control mode, and analogWrite(255) is constant LOW which means full speed, not stop"
type: claim
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[breadboard-intelligence]]"
  - "[[eda-fundamentals]]"
---

# ZS-X11H EL speed input is active-low and flips polarity between PWM and analog modes

The ZS-X11H BLDC controller's EL (speed) input is the single most dangerous pin on the board because its behavior is counterintuitive in two distinct ways.

**First trap: PWM is active-LOW.** In PWM mode (50Hz-20kHz), the LOW portion of each cycle is the active time. A 0% duty cycle (constant HIGH) means the motor is stopped. A signal that is mostly LOW means the motor runs fast. This is backwards from every other common motor controller (L298N, TB6612, ESC) where higher duty cycle means more speed. The inversion formula for Arduino is `analogWrite(EL_PIN, 255 - desiredSpeed)` where desiredSpeed ranges from 0 (stop) to 255 (full speed).

**Second trap: analogWrite(255) is NOT stop.** Because Arduino's `analogWrite(pin, 255)` outputs a constant LOW (not a 100% duty cycle HIGH), the controller reads it as "always active" and runs at full speed. And `analogWrite(pin, 0)` outputs a constant HIGH, which the controller reads as "never active" and stops. This is a subtle platform interaction where the Arduino PWM implementation and the controller's active-LOW logic conspire to produce behavior opposite to what the code appears to say.

**Third trap: analog mode inverts the convention.** If you feed a DC voltage (0-5V) to EL instead of PWM, the mapping is normal: 0V = stop, 5V = full speed. This is the opposite of PWM mode's LOW=fast convention. A beginner who learns the analog behavior and then switches to PWM (or vice versa) will get the motor running at full speed unexpectedly.

**The safe startup pattern:** Always set EL to constant HIGH (`analogWrite(EL_PIN, 0)` or `digitalWrite(EL_PIN, HIGH)`) before enabling the controller via the STOP pin. Then ramp the inverted PWM value down gradually from 255 toward 0. Never leave EL floating -- it has no pull-up, and a floating input on an active-LOW system means the motor may default to full speed.

**ProtoPulse implication:** When the bench coach detects a ZS-X11H in the schematic connected to an Arduino PWM pin, it should: (1) warn about the active-LOW convention, (2) auto-generate the inversion wrapper, and (3) flag if the code uses raw `analogWrite` without inversion. This is exactly the kind of mistake that since [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]], the AI should catch before the motor spins unexpectedly.

---

Source: [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]

Relevant Notes:
- [[bldc-stop-active-low-brake-active-high]] -- the STOP/BRAKE polarity traps on the same controller family
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- BLDC PWM is not the same as DC motor PWM, and this active-LOW convention makes it even more alien
- [[hall-sensor-wiring-order-matters-for-bldc]] -- another wiring trap where wrong connections produce unexpected motor behavior
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- the EL inversion is a prime candidate for proactive AI intervention

Topics:
- [[actuators]]
- [[breadboard-intelligence]]
- [[eda-fundamentals]]
