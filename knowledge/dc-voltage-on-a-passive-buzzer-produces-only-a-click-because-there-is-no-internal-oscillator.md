---
description: "A passive buzzer is a bare piezo element -- applying steady DC deflects the disc once and holds it there, producing a single click on connect and disconnect but no continuous tone"
type: claim
source: "docs/parts/passive-piezo-buzzer-3-5v-pwm-driven-tone-generator.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
related_components:
  - "passive-piezo-buzzer"
  - "active-piezo-buzzer"
---

# DC voltage on a passive buzzer produces only a click because there is no internal oscillator

A passive piezo buzzer is a ceramic disc bonded to a metal plate. Apply voltage and the disc deflects due to the piezoelectric effect. Remove voltage and it returns. To produce audible sound, the disc must vibrate continuously -- which requires an alternating signal (square wave, sine wave) at the desired frequency.

**What happens with DC:**
1. Voltage applied: disc deflects once -- audible "click"
2. Voltage held: disc stays deflected -- silence
3. Voltage removed: disc returns -- second "click"

This is the single most common beginner confusion when working with buzzers. Active and passive buzzers look physically identical (same form factor, same pins, same markings or lack thereof). The only reliable test is applying DC: if it produces a continuous tone, it has an internal oscillator (active). If it clicks once, it's passive.

**Why beginners get burned:**
- They buy a "buzzer" with no active/passive label (extremely common on generic parts)
- They wire it with `digitalWrite(pin, HIGH)` expecting a continuous beep
- They get silence (or a quiet click they might not hear)
- They assume the buzzer is broken or the wiring is wrong
- The actual fix -- switching from `digitalWrite` to `tone()` -- requires understanding that the control paradigm is frequency-driven, not voltage-driven

**The active buzzer trap works in reverse too:** Applying `tone()` to an active buzzer produces a garbled or warbling sound because the external frequency modulates the internal oscillator's fixed frequency, creating beat patterns.

**ProtoPulse implications:** When a user adds a buzzer to a schematic, the bench coach should ask whether it's active or passive (or offer the DC test procedure) before generating control code. The component library should maintain active and passive as distinct component types, not variants of one type, because their control paradigms are incompatible.

---

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- buzzer row: DC on/off (active) vs PWM frequency (passive)
- [[salvaged-generic-components-have-no-datasheets-so-specs-must-be-determined-empirically]] -- unlabeled buzzers are a prime example of "test first"

Topics:
- [[actuators]]
- [[eda-fundamentals]]
