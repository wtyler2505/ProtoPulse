---
description: "DC motors use PWM duty cycle for speed, servos use PWM pulse width for position, steppers use step sequences, and BLDC motors need 3-phase commutation -- 'PWM' appears in all of them but means completely different things"
type: knowledge-note
source: "docs/parts/actuators.md"
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# each actuator type requires a fundamentally different control signal paradigm

A beginner looking at a quick reference table sees "PWM" listed for DC motors, servos, and BLDC motors and assumes the control method is the same. It is not.

**The five actuator control paradigms:**

| Actuator Type | Control Signal | What It Actually Means |
|--------------|---------------|----------------------|
| Brushed DC motor | PWM + direction pin | Duty cycle controls average voltage = speed. Direction pin reverses polarity via H-bridge |
| Servo (SG90, MG996R) | PWM pulse width | 1ms = 0 degrees, 1.5ms = 90 degrees, 2ms = 180 degrees. Period is 20ms (50Hz). Duty cycle is irrelevant -- only pulse width matters |
| Stepper (28BYJ-48, NEMA17) | Step + direction sequence | Each pulse advances one step (1.8 or 5.625 degrees). Speed = pulse frequency. Microstepping subdivides steps |
| BLDC (hoverboard motors) | 3-phase PWM + Hall feedback | ESC/controller commutates three phases based on rotor position from Hall sensors. Not user-controllable PWM |
| Relay / solenoid | Digital HIGH/LOW | On or off. No speed control. PWM would just click the relay rapidly |
| Buzzer (active vs passive) | DC on/off vs PWM frequency | Active: DC power = fixed tone. Passive: PWM frequency = pitch (audible range ~20Hz-20kHz, loudest at piezo resonance ~2-4kHz), duty cycle = volume (50% is loudest). Applying DC to passive produces only a click -- no oscillator means no vibration |

**Why this matters for ProtoPulse:** When a user drags an actuator onto a schematic, the AI bench coach should surface the correct control paradigm and wire the appropriate driver. Connecting a servo signal pin to a motor driver's PWM input is a common and destructive mistake.

---

Topics:
- [[actuators]]
- [[eda-fundamentals]]
