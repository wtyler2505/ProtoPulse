---
description: "The inventory reveals four natural voltage tiers (logic 3-5V, servo 5-6V, mid-power 5-46V, high-power 6-60V) -- each tier implies a different power supply strategy from shared regulator to isolated battery with fusing"
type: knowledge-note
source: "docs/parts/actuators.md, docs/parts/power.md"
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# actuator voltage tiers map to distinct power supply strategies

The parts inventory reveals four natural voltage tiers across actuator types. Each tier has different power supply requirements, and a project using multiple tiers (like a rover with servos, DC motors, and BLDC motors) needs multi-rail power distribution.

**The four voltage tiers:**

| Tier | Voltage Range | Actuator Examples | Power Supply Strategy |
|------|--------------|-------------------|----------------------|
| Logic-level | 3-5V | Active/passive buzzers, small DC motors | Can share the MCU's onboard regulator. Minimal current draw. No isolation needed |
| Servo-level | 4.8-6V | SG90/MG996R servos, 28BYJ-48 stepper, 5V relays | Dedicated 5V/6V rail. Servos draw current spikes (stall current 500mA-2.5A each) that will brown out the MCU if shared. Use a separate BEC or regulator |
| Mid-power | 5-46V | L293D/L298N/TB6612 motor drivers, motor shields | Separate motor supply with common ground to MCU. The driver's logic side connects to MCU power; the motor side to the separate supply. Decoupling capacitors at driver inputs |
| High-power | 6-60V | BLDC controllers (ZS-X11H), ESCs, large steppers | Own battery/BMS with inline fuse, optocoupler or level-shifted control signals, physical separation on PCB. Current can be 10-30A continuous |

**Multi-tier project planning (rover example):**
- A rover with servo steering, brushed DC drive motors, and BLDC hoverboard motors needs at least 3 separate power rails
- Common ground bus connects all rails but power traces must be separated
- Fusing: each high-power rail needs an inline fuse rated above continuous draw but below wiring capacity
- The MCU (Arduino Mega, ESP32) lives on the logic rail and communicates with drivers on other rails via signal-level connections only

**System-centric rail view (from power supply side):**

The actuator-centric tiers above describe demand. The power supply inventory reveals the complementary source perspective — where each rail typically comes from:

| Rail | Typical Consumers | Typical Source |
|------|-------------------|----------------|
| 3.3V | ESP modules, sensors | LDO regulator, board-level output |
| 5V | Arduino, servos, most modules | USB, buck converter |
| 7-12V | Arduino Vin, motor drivers | Battery pack, wall adapter |
| 12-36V | DC motors, brushless motors | Battery pack |

The demand tiers and source rails don't map 1:1 — the servo-level tier (4.8-6V) and logic-level tier (3-5V) both draw from the 5V and 3.3V source rails, while the mid-power and high-power demand tiers map to the 7-12V and 12-36V source rails respectively. Understanding both perspectives is necessary for correct power distribution design.

**ProtoPulse implication:** The architecture view and power analysis tools should identify voltage tiers automatically from the BOM and flag when components on different tiers share a power rail without proper regulation or isolation.

---

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
