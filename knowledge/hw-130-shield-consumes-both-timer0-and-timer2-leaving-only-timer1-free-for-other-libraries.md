---
description: "The HW-130 motor shield assigns M3/M4 speed to pins 5/6 (Timer0) and M1/M2 speed to pins 3/11 (Timer2) -- running all four channels consumes both timers, leaving only Timer1 for Servo, tone, or IRremote"
type: claim
source: "docs/parts/dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[actuators]]"
  - "[[microcontrollers]]"
related_components:
  - "dk-electronics-hw-130-motor-shield"
  - "arduino-uno-r3"
---

# hw-130 shield consumes both timer0 and timer2 leaving only timer1 free for other libraries

The HW-130 motor shield's PWM pin assignments make it a hidden consumer of two of the ATmega328P's three hardware timers. M1/M2 speed control uses pins 3 and 11 (Timer2). M3/M4 speed control uses pins 5 and 6 (Timer0). Driving all four motor channels simultaneously therefore occupies Timer0 and Timer2 for their PWM generators, leaving only Timer1 (pins 9, 10) free for other libraries.

**The resource-conflict chain:**
- `millis()` and `delay()` use Timer0 -- the HW-130 sharing Timer0 PWM with millis() works because PWM and timer interrupt are independent, but any library that reprograms Timer0's prescaler (some audio libraries, fast-PWM hacks) will break millis()
- `tone()` uses Timer2 -- calling `tone()` while M1 or M2 is running breaks motor PWM silently, and stopping `tone()` does not reliably restore it
- `IRremote` transmit uses Timer2 -- same conflict as `tone()`
- `Servo.h` uses Timer1 -- safe to combine with HW-130, which is why the shield has unpopulated servo headers that connect directly to pins 9 and 10

**The practical implication:** A project using the HW-130 with 4 motors AND a buzzer with `tone()` AND an IR transmitter AND servos is ALL-IN on timer conflicts. Since [[arduino-tone-uses-timer2-which-disables-pwm-on-pins-3-and-11-creating-invisible-resource-conflicts]], using `tone()` alongside M1/M2 silently breaks motor speed control on those channels. The only safe combination: HW-130 + servos on pins 9/10 (Timer1) + NO tone/IR.

**Why only 2 motors is safer:** Using only M1 and M2 (or only M3 and M4) leaves one timer free. HW-130 + M3/M4 only + Servo is fully safe -- M1/M2 pins 3 and 11 are unused, and Timer2 is available for tone/IR. HW-130 + M1/M2 only + Servo is also safe -- Timer0 millis continues working, and pins 5/6 are available as standard digital/analog I/O.

**ProtoPulse implication:** The pin assignment DRC should track timer consumption as a first-class resource whenever the HW-130 is added to a design. Selecting the HW-130 with all 4 motor channels active should disable `tone()` and `IRremote` options in the firmware template generator, and show a warning that only Timer1-based libraries (Servo) are compatible.

---

Source: [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]]

Relevant Notes:
- [[arduino-tone-uses-timer2-which-disables-pwm-on-pins-3-and-11-creating-invisible-resource-conflicts]] -- same timer conflict, different consumer
- [[shield-pin-conflicts-are-invisible-until-stacking-fails]] -- timer conflicts are a species of invisible shield conflict, at the resource layer rather than the pin layer
- [[l293d-separates-speed-control-on-enable-pins-from-direction-control-on-input-pins]] -- the speed-control architecture is what makes the shield a timer consumer

Topics:
- [[shields]]
- [[actuators]]
- [[microcontrollers]]
