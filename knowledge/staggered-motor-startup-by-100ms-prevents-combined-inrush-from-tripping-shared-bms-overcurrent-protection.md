---
description: "Two or more motors accelerating simultaneously from a single battery stack up their inrush currents, often exceeding the BMS trip point even when each individual motor stays within its limit — offsetting motor start commands by 100ms spreads the inrush peaks in time, keeping instantaneous current below the trip threshold without requiring current sensing hardware"
type: claim
source: "docs/parts/wiring-dual-zs-x11h-for-hoverboard-robot.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# staggered motor startup by 100ms prevents combined inrush from tripping shared BMS overcurrent protection

BMS overcurrent protection measures instantaneous current, not time-averaged current. When two BLDC motors both command "start" in the same millisecond, their acceleration phases begin simultaneously, and their inrush peaks add to a single combined spike. Even if each motor's peak is well under the BMS threshold, the sum is often over it. The BMS trips, cuts power to everything, and since [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] the MCU dies mid-acceleration with no chance to recover gracefully.

The fix is almost embarrassingly simple: start the motors 100 milliseconds apart.

```cpp
driveMotor(LEFT, targetSpeed);
delay(100);
driveMotor(RIGHT, targetSpeed);
```

100ms is long enough that the left motor's inrush peak has passed before the right motor's peak begins. Combined current at any instant stays close to the single-motor peak rather than the sum. The motors still reach target speed nearly simultaneously from a human perception standpoint (100ms is below the flicker-fusion threshold for motion perception), so the robot still moves as if both motors started together.

**Why this is a better-than-nothing fix:** Unlike firmware current limiting, which requires a current sensor on the battery bus and closed-loop PWM throttling, staggered startup is purely a timing change in software. No hardware change, no new sensors, no tuning. For projects at the edge of BMS capacity — like [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] where four motors compete for a 30-40A budget — staggering each motor's start by 100ms (total 300ms for 4 motors) buys enough margin to avoid trips in practice.

**The mitigation hierarchy** is clearer when staggered startup is included:

1. **Staggered startup (free)** — timing-only, no hardware, no new sensors
2. **Ramp-up acceleration** — smooth PWM from 0 to target over 500ms, reduces peak inrush per motor
3. **Firmware current limiting** — requires current sensor, closed-loop throttling
4. **BMS upgrade** — replace 30A BMS with 60A+ unit
5. **Dual battery packs** — split the load between two BMS

Staggered startup and ramp-up together eliminate nuisance trips for most dual and quad motor rovers without touching the power architecture. The higher-tier fixes become necessary only when sustained load (not just inrush) approaches the BMS limit.

**The anti-pattern to flag:** A movement function that issues both motor commands on adjacent lines:
```cpp
setLeftSpeed(targetSpeed);
setRightSpeed(targetSpeed);  // 0ms gap — combined inrush hits BMS
```
Looks correct. Works on the bench. Fails at the edge of the current budget.

**ProtoPulse implication:** When the bench coach generates movement code for multi-motor systems sharing a BMS, it should emit staggered starts by default (with a comment explaining why) rather than simultaneous commands. The comment prevents a future refactor from "cleaning up" the delay and reintroducing the failure mode.

---

Source: [[wiring-dual-zs-x11h-for-hoverboard-robot]]

Relevant Notes:
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] — the system-level constraint that makes staggered startup valuable; this note adds a cheaper mitigation to that note's hierarchy
- [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] — why a BMS trip is especially costly, making prevention worth the effort
- [[neopixel-rings-need-a-bulk-electrolytic-capacitor-across-power-to-absorb-inrush-current]] — same underlying problem (inrush peak exceeds steady-state capacity) solved with capacitance instead of timing
- [[tank-steering-replaces-mechanical-steering-with-differential-wheel-speed-control]] — tank steering requires both motors running, so staggered startup is the default not an exception

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
