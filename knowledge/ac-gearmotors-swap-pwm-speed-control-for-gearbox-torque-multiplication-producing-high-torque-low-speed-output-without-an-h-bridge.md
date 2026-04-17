---
description: "AC gearmotors deliver high torque at low speed (tens to hundreds of RPM) using a fixed-ratio gearbox on a constant-speed single-phase motor — you trade variable-speed PWM control for simplicity and ruggedness, which is why conveyors, door openers, and industrial actuators use AC gearmotors instead of DC+H-bridge+gearhead combos"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[actuators]]"
---

# AC gearmotors swap PWM speed control for gearbox torque multiplication, producing high-torque low-speed output without an H-bridge

An AC gearmotor combines a single-phase AC motor (typically PSC or shaded-pole) with an integrated gearbox in one housing. The motor runs at roughly synchronous speed (1550 RPM in the Von Weise V05748AN76 example, derived from 60Hz / 4-pole design with slip), and the gearbox reduces this by the gear ratio (19:1 → ~82 RPM output) while multiplying torque by approximately the same factor.

**Why industrial equipment uses AC gearmotors instead of DC+H-bridge+gearhead:**

| Attribute | AC gearmotor | DC motor + H-bridge + gearhead |
|-----------|-------------|-------------------------------|
| Speed control | Fixed at line frequency | Full PWM variable |
| Complexity | Plug it into a wall outlet | Driver, MCU, PSU, heatsink |
| Reliability (hours) | 20,000+ hours typical | Driver FETs often fail first |
| Cost at high power | Cheap above ~1/4 HP | Expensive at high power |
| EMI | Clean, predictable | PWM is EMI-noisy |
| Position control | None (or limited, via encoder) | Full servo control possible |
| Mounting | Standardized NEMA/IEC flanges | Usually custom |

**When AC gearmotor is the right choice:**
- Conveyors running at constant speed
- Automatic door openers with fixed open/close time
- Mixers, agitators, pumps with fixed RPM needs
- Industrial actuators with simple limit switches (no servo loop needed)

**When DC+H-bridge is the right choice:**
- Variable-speed robotics
- Anything needing servo position control
- Battery-powered applications (AC gearmotors need mains or inverter)
- High-dynamic-range speed control (0.1× to 10× rated)

**The "intermittent duty" gotcha:**
Many cheap AC gearmotors are rated intermittent duty (15-30 min on, equal time off). Running them continuously trips thermal protection or burns windings. For continuous use, specify a continuous-duty motor — often 2-3× the price of intermittent-duty for same power rating.

**Output units confusion:**
Nameplates list output as "10.5 IN/MIN @ 600 LBS" (Von Weise) or "Torque: 450 in-lb @ 82 RPM." The "IN/MIN" format on a rotary motor suggests linear actuator packaging — the gearbox may drive a lead screw rather than output a rotating shaft directly. Always check the output shaft configuration, not just the RPM.

---

Source: docs_and_data

Relevant Notes:
- [[permanent-split-capacitor-psc-motor-uses-an-always-in-circuit-run-capacitor-to-generate-the-rotating-field-that-single-phase-ac-cannot-produce-natively]] — the AC motor electrical foundation
- [[cytron-md25hv-completes-the-brushed-dc-driver-voltage-ladder-tb6612-at-13v-l298n-at-46v-md25hv-at-58v-with-25a-continuous]] — the DC+H-bridge alternative

Topics:
- [[actuators]]
