---
description: "Hall sensors in BLDC motors are open-collector with pull-ups to 5V, producing a 6-state Gray code per electrical revolution -- states 000 and 111 indicate broken or disconnected sensors"
type: claim
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
  - "[[breadboard-intelligence]]"
---

# hall sensor open-collector outputs need pull-up resistors and produce Gray code not binary position

The Hall effect sensors built into BLDC hub motors are latching bipolar type with open-collector outputs. This means they cannot drive a HIGH state on their own -- they need a pull-up resistor to VCC (typically 5V, supplied by the controller's onboard 78L05 regulator). When the magnetic field flips, the output transistor either saturates (pulling to <0.4V) or releases (pulled HIGH to 4.5-5V by the resistor). Most BLDC controllers include these pull-ups internally, but custom controller designs must provide them explicitly.

The three sensors produce a 6-state Gray code per electrical revolution, not a simple binary position encoding:

| Step | Hall A | Hall B | Hall C | Binary | Decimal | Active Phases |
|------|--------|--------|--------|--------|---------|--------------|
| 1 | 1 | 0 | 1 | 101 | 5 | A+, C- |
| 2 | 0 | 0 | 1 | 001 | 1 | B+, C- |
| 3 | 0 | 1 | 1 | 011 | 3 | B+, A- |
| 4 | 0 | 1 | 0 | 010 | 2 | C+, A- |
| 5 | 1 | 1 | 0 | 110 | 6 | C+, B- |
| 6 | 1 | 0 | 0 | 100 | 4 | A+, B- |

This is Gray code because only one bit changes between adjacent states. The sequence repeats every electrical revolution (which is NOT one mechanical revolution -- with 15 pole pairs, there are 15 electrical revolutions per wheel turn, yielding 90 state transitions per mechanical revolution).

**The critical diagnostic:** States 0 (000) and 7 (111) should NEVER occur in normal operation. If you see them while monitoring Hall outputs:
- 000 means at least one sensor that should be HIGH is stuck LOW (disconnected power, broken sensor)
- 111 means at least one sensor that should be LOW is stuck HIGH (shorted output, broken sensor)

Either invalid state means the controller cannot commutate properly. The motor may vibrate, stall, or run erratically. This is the first thing to check when troubleshooting BLDC motor problems.

---

Source: [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]

Relevant Notes:
- [[hall-sensor-wiring-order-matters-for-bldc]] -- wrong wiring order produces valid but incorrect commutation sequences
- [[bldc-stop-active-low-brake-active-high]] -- controller signal conventions for the same system
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- Gray code commutation is what makes BLDC control fundamentally different from DC PWM

Topics:
- [[actuators]]
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
