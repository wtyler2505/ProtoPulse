---
description: "tone() on ATmega328P (Uno/Nano) occupies Timer2 exclusively, silently disabling analogWrite() on pins 3 and 11 with no compile warning or runtime error"
type: claim
source: "docs/parts/passive-piezo-buzzer-3-5v-pwm-driven-tone-generator.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "passive-piezo-buzzer"
  - "arduino-uno-r3"
  - "arduino-nano-v3"
---

# Arduino tone() uses Timer2 which disables PWM on pins 3 and 11 creating invisible resource conflicts

Calling `tone()` on an Arduino Uno or Nano commandeers Timer2 for the duration of the tone. Timer2 also generates the PWM output for pins 3 and 11. The result: any `analogWrite()` call on those pins silently produces a wrong or absent PWM signal while a tone is playing. There is no compile-time warning and no runtime error -- the pin just stops doing what the sketch expects.

**Why beginners hit this constantly:** A passive buzzer is often the first component a beginner wires up (simple two-pin connection, satisfying audio feedback). It's also the first time they use `tone()`. If they already have an LED fading on pin 3 or a motor speed controller on pin 11, the LED goes full-bright or the motor speed locks -- and the correlation with buzzer code is non-obvious because the symptom appears on a completely different pin.

**Timer resource map on ATmega328P:**

| Timer | PWM Pins Affected | Common Consumers |
|-------|-------------------|------------------|
| Timer0 | 5, 6 | `millis()`, `delay()` -- never touch this |
| Timer1 | 9, 10 | `Servo.h`, frequency generators |
| Timer2 | 3, 11 | `tone()`, `IRremote` transmit |

**The conflict chain:** If a project uses `tone()` for a buzzer AND `IRremote` for IR transmitting, both want Timer2. The IRremote library documents this (it disables tone support when active), but a beginner combining two working sketches into one will get silent failure on whichever feature initializes second.

**ProtoPulse implications:** Pin assignment DRC should track timer ownership as a first-class resource. When a user assigns a passive buzzer to any pin and the firmware will use `tone()`, the DRC should flag pins 3 and 11 as PWM-unavailable and warn about any existing PWM assignments on those pins.

---

Relevant Notes:
- [[ir-transmitter-requires-software-generated-38khz-carrier-while-receiver-demodulates-in-hardware-creating-a-complexity-asymmetry]] -- another Timer2 consumer that conflicts with tone()
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- tone() is one paradigm that consumes a shared timer resource
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- same class of invisible resource conflict across boards

Topics:
- [[actuators]]
- [[breadboard-intelligence]]
