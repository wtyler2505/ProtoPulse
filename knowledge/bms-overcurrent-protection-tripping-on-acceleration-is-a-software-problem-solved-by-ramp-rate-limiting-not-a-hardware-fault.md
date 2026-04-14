---
description: "A motor that spins up briefly then cuts out is almost never a BMS fault or a failing controller — it is a firmware issue where the commanded speed step is too steep, the instantaneous inrush exceeds the BMS discharge limit, and the BMS trips as designed; the fix is a ramp function in setMotorSpeed(), not a hardware replacement"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[microcontrollers]]"
related_components:
  - "riorand-zs-x11h"
  - "hoverboard-10s-battery-pack"
---

# BMS overcurrent protection tripping on acceleration is a software problem solved by ramp rate limiting not a hardware fault

The characteristic failure pattern looks like a hardware defect. The motor spins up, runs for a fraction of a second, then cuts out. Power-cycling the battery resumes normal behavior — for exactly one more brief spin before cutting out again. Every instinct says "the BMS is broken" or "the controller is bad." Neither diagnosis survives a look at the inrush waveform.

A BLDC motor commanded from 0% to 100% PWM in one MCU cycle is a voltage source applied directly to an inductor (the winding) with only the winding resistance limiting the initial current. For a 250W hoverboard motor at 36V with ~0.2 ohm phase resistance, the step-response initial current is 36V / 0.2 ohm = 180A. The current falls exponentially as the back-EMF builds up, reaching the steady-state running current of ~8-10A within 50-100ms. Most of the 180A peak lasts only a few milliseconds — imperceptible on a multimeter but clearly above the BMS's trip threshold.

Hoverboard BMS units trip at 30-40A with fast response (sub-millisecond). The 180A inrush transient is six times the trip threshold. The BMS does its job — it disconnects the battery to prevent cell damage. The firmware sees this as "motor stopped unexpectedly" and often retries, hitting the same trip on the next attempt. The loop continues until someone either swaps hardware (which does nothing) or adds a speed ramp.

The fix is a ramp function that spreads the speed step across enough time for the back-EMF to build up before the commanded speed arrives. Empirically, a rate of 5 PWM counts per 20ms (effectively 0-to-full in ~1 second) limits inrush to ~30A peak — under the BMS threshold and unnoticeable to a human operator:

```cpp
int currentSpeed = 0;
int targetSpeed = 0;
const int RAMP_RATE = 5;       // PWM counts per step
const int RAMP_INTERVAL = 20;  // ms per step
unsigned long lastRampTime = 0;

void setTargetSpeed(int newTarget) {
  targetSpeed = constrain(newTarget, 0, 255);
}

void updateRamp() {
  unsigned long now = millis();
  if (now - lastRampTime < RAMP_INTERVAL) return;
  lastRampTime = now;

  if (currentSpeed < targetSpeed) {
    currentSpeed = min(currentSpeed + RAMP_RATE, targetSpeed);
  } else if (currentSpeed > targetSpeed) {
    currentSpeed = max(currentSpeed - RAMP_RATE, targetSpeed);
  }
  setMotorSpeed(currentSpeed);  // invert for active-LOW EL
}
```

The ramp rate is a tunable parameter, not a universal constant. A higher-Ohm motor, a larger BMS, or a softer load all allow a steeper ramp. A stiffer BMS (lower trip threshold) or a higher motor voltage demands a gentler ramp. The tuning loop is: start conservative (5 counts per 20ms), increase until the BMS starts tripping, back off by 25%. Most hoverboard-motor-class systems land somewhere in the 5-10 counts per 20ms window.

The relationship to [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting|multi-motor firmware current limiting]] is a useful contrast. That rule addresses steady-state current exceeding BMS ratings when multiple motors run simultaneously. This rule addresses transient inrush during a single motor's acceleration. The two failure modes can coexist in a 4-motor rover, and both rules apply independently: stagger starts to spread inrush across time, then ramp each motor's speed to keep each individual inrush under threshold. The [[staggered-motor-startup-by-100ms-prevents-combined-inrush-from-tripping-shared-bms-overcurrent-protection|100ms stagger]] and the per-motor ramp are complementary layers of the same firmware-first protection strategy.

The diagnostic heuristic: if the motor spins before it stops, it is probably a firmware problem. If the motor never moves, it is probably a wiring problem. The BMS is almost never broken — it is one of the few hardware components on the rover that is actively protecting itself correctly.

---

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]]

Relevant Notes:
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] — the steady-state counterpart rule
- [[staggered-motor-startup-by-100ms-prevents-combined-inrush-from-tripping-shared-bms-overcurrent-protection]] — the multi-motor timing complement
- [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]] — the polarity that the setMotorSpeed() invert depends on
- [[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]] — the related inrush hazard during direction changes

Topics:
- [[actuators]]
- [[power-systems]]
- [[microcontrollers]]
