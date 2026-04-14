---
description: "Every safety-relevant BLDC control pin must be driven to its passive state before any pin is driven to an active state — the correct setup() order is EL HIGH (stopped, active-LOW pin) → DIR to a default → CT LOW (brake engaged) → STOP LOW (controller disabled) → attach interrupts → only then is it safe to command motion"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[microcontrollers]]"
related_components:
  - "riorand-zs-x11h"
  - "arduino-mega-2560"
  - "esp32"
---

# Safe BLDC startup sequence initializes EL stopped then brake engaged then enable LOW before setting any active state

A BLDC controller with separate enable, speed, direction, and brake signals has a multi-dimensional state space, and the `setup()` function is the narrow window in which firmware chooses where in that space the system starts. The wrong starting point — any pin in its active state before the controller is even enabled — lets the motor react to whatever transient signal happens to be present at power-up. The right starting point is the same every time: every signal driven to its passive state, the controller explicitly disabled, and only then do interrupts attach and commanded motion become possible.

The ordering is load-bearing, not cosmetic. Consider the ZS-X11H's four signals with their polarities:

| Signal | Active state | Passive state | What it controls |
|--------|--------------|---------------|------------------|
| EL (speed) | LOW | HIGH | Active-LOW PWM — LOW means full speed |
| DIR (Z/F) | either | either (default LOW = forward) | Commutation sequence direction |
| CT (brake) | LOW | HIGH | LOW engages dynamic braking |
| STOP (enable) | HIGH | LOW | HIGH enables controller |

The correct sequence writes each pin to its passive value before calling `pinMode(..., OUTPUT)` on the pin that would otherwise "win" the race at power-up. For the Arduino `digitalWrite` convention, `digitalWrite` must follow `pinMode`, so the order in code becomes:

```cpp
void setup() {
  Serial.begin(115200);

  // 1. Drive STOP to its passive (disabled) state FIRST
  pinMode(PIN_ENABLE, OUTPUT);
  digitalWrite(PIN_ENABLE, LOW);        // controller disabled

  // 2. Drive EL to its passive (stopped) state before anything
  //    can set STOP HIGH and give the motor permission to run
  pinMode(PIN_SPEED, OUTPUT);
  analogWrite(PIN_SPEED, 255);          // EL HIGH = stopped

  // 3. Brake engaged, direction to a default
  pinMode(PIN_BRAKE, OUTPUT);
  digitalWrite(PIN_BRAKE, LOW);         // brake engaged
  pinMode(PIN_DIR, OUTPUT);
  digitalWrite(PIN_DIR, LOW);           // forward

  // 4. Only now attach interrupts and enable comms
  pinMode(PIN_FEEDBACK, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_FEEDBACK), countPulse, RISING);

  Serial.println("Motor controller ready. Send 0-255 for speed.");
  // Note: motor is still disabled — a subsequent enableMotor()
  // call under user control is what lifts STOP to HIGH.
}
```

Rule 1: **STOP first, EL before STOP could go HIGH.** If any subsequent line in `setup()` accidentally drives STOP HIGH before EL is at its stopped value, the motor spins up on the next clock edge. Initializing EL to stopped before STOP is ever touched makes the STOP assertion harmless on its own.

Rule 2: **Brake passive (engaged) before enable.** While the motor is disabled, brake state is a don't-care — no current flows through it. But the moment STOP goes HIGH in a later `enableMotor()` call, the brake's passive state becomes load-bearing. Entering enable with CT LOW (brake engaged) means the motor cannot accelerate on spurious speed commands while the firmware is still settling.

Rule 3: **Interrupts and communication attach after safe state is established.** An ISR that fires during `setup()` and touches pin state can undo the passive initialization. Attach interrupts last.

Rule 4: **Never set STOP HIGH in `setup()`.** Enabling the motor is always a separate call triggered by user intent — a button press, a serial command, the end of a safety interlock check. The firmware startup should leave the system in the "ready, but not armed" state.

This pattern generalizes to any multi-signal actuator interface. Servo controllers with enable + PWM: drive enable LOW, PWM to center pulse, then attach interrupts. Stepper drivers with enable + step/dir: drive enable HIGH (disabled), step LOW, dir to a default. The rule is always the same: passive everything, then enable interrupts, then leave arming to a deliberate user-commanded transition.

The [[el-pin-floating-at-mcu-boot-defaults-the-motor-to-full-speed-so-explicit-high-initialization-is-mandatory-before-stop-is-enabled|boot-window hazard]] is what this sequence exists to close.

---

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]]

Relevant Notes:
- [[el-pin-floating-at-mcu-boot-defaults-the-motor-to-full-speed-so-explicit-high-initialization-is-mandatory-before-stop-is-enabled]] — the hazard this sequence closes
- [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]] — the polarity rule that makes EL-stopped = EL-HIGH
- [[bldc-stop-active-low-brake-active-high]] — the STOP and CT polarities used in the sequence
- [[stop-is-the-correct-emergency-kill-and-ct-brake-is-for-controlled-deceleration-because-only-stop-removes-the-controller-power-path-entirely]] — which signal does what after startup

Topics:
- [[actuators]]
- [[microcontrollers]]
