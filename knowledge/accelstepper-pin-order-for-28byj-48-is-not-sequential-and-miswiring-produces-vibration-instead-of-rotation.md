---
description: "AccelStepper expects pins in the order IN1, IN3, IN2, IN4 (not IN1-IN2-IN3-IN4) for the 28BYJ-48 -- using sequential pin order produces coil energization that vibrates the motor in place rather than rotating it"
type: gotcha
source: "docs/parts/28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# accelstepper pin order for 28byj-48 is not sequential and miswiring produces vibration instead of rotation

The AccelStepper library's constructor for half-step mode takes four pin arguments that correspond to the motor coils, but the expected order is NOT the physical connector pin sequence. For the 28BYJ-48 with ULN2003 driver:

```cpp
#define HALFSTEP 8
AccelStepper stepper(HALFSTEP, 8, 10, 9, 11); // IN1, IN3, IN2, IN4
```

The constructor signature is `AccelStepper(type, pin1, pin3, pin2, pin4)` -- note pins 2 and 3 are swapped relative to the physical ULN2003 board labeling. This means if you wire Arduino pins 8, 9, 10, 11 to ULN2003 IN1, IN2, IN3, IN4 respectively, you pass them as `(8, 10, 9, 11)` to the constructor.

**Why this is a gotcha:** The natural assumption is sequential ordering. Every beginner will write `AccelStepper stepper(HALFSTEP, 8, 9, 10, 11)` first. The motor will buzz/vibrate without rotating because the coil energization sequence is wrong -- it's energizing opposing coils simultaneously instead of creating a rotating magnetic field.

**The debugging trap:** The motor vibrating feels like a wiring error or power issue. The ULN2003's LEDs will even flash in a pattern that looks "active." Nothing in the error manifests as a pin ordering problem unless you already know about it. Beginners will:
1. Check all physical connections (correct)
2. Check power supply (adequate)
3. Try different speeds (doesn't help)
4. Question the motor (it's fine)

...before eventually finding a forum post about pin ordering.

**ProtoPulse implication:** The AI bench coach should auto-detect AccelStepper usage with 28BYJ-48 in the BOM and validate pin argument ordering against the standard non-sequential pattern. A "motor vibrates but doesn't rotate" diagnostic should immediately check pin ordering.

---

Source: [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]]

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- step sequences are specific to coil ordering; getting it wrong doesn't just "not work," it actively vibrates
- [[arduino-clone-bootloader-mismatch-causes-upload-failure-that-looks-like-hardware-fault]] -- same pattern: software configuration error presenting as hardware problem

Topics:
- [[actuators]]
- [[eda-fundamentals]]
