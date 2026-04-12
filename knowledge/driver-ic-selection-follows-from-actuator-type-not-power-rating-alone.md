---
description: "Choosing a motor driver by current/voltage rating alone is a common beginner mistake -- the actuator type determines the driver architecture (H-bridge, Darlington sink, 3-phase bridge, direct GPIO), and only then do you filter by power rating"
type: knowledge-note
source: "docs/parts/actuators.md"
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# driver IC selection follows from actuator type not power rating alone

A common beginner mistake: "My motor needs 12V at 2A, so I'll use an L298N (rated 36V/2A)." This works for brushed DC motors but fails completely for BLDC, steppers (wrong architecture), and servos (no driver needed).

**The correct driver selection flow:**

1. **Identify actuator type** -- this determines the driver architecture
2. **Match architecture** -- each type needs a fundamentally different circuit topology
3. **Filter by rating** -- only now does voltage/current matter

**Driver architecture by actuator type:**

| Actuator Type | Driver Architecture | Example ICs | Why This Architecture |
|--------------|-------------------|-------------|---------------------|
| Brushed DC motor | H-bridge (dual or quad) | L293D, L298N, TB6612FNG | Needs bidirectional current flow for forward/reverse |
| Unipolar stepper | Darlington sink array | ULN2003 | Only sinks current to ground; coils are driven from VCC |
| Bipolar stepper | Dual H-bridge or dedicated | A4988, DRV8825, TMC2209 | Needs current reversal in each coil pair |
| Servo | Direct GPIO (no driver) | None needed | Servo has onboard controller; MCU provides PWM signal only |
| BLDC motor | 3-phase bridge + commutation | ESC, ZS-X11H, VESC | Needs 3-phase switching synchronized to rotor position via Hall sensors |
| Relay / solenoid | Single transistor or MOSFET | 2N2222, IRLZ44N | Just needs to switch a coil; flyback diode required |

**The destructive mistake:** An L298N can deliver 36V/2A but cannot drive a BLDC motor because it has no commutation logic -- it would energize two phases continuously instead of rotating the magnetic field, stalling the motor and potentially burning the driver or motor windings.

**ProtoPulse implication:** The BOM validation and AI tools should check actuator-driver compatibility, not just voltage/current adequacy. If a user pairs a BLDC motor with an L298N, that is a DRC error, not a warning.

---

Topics:
- [[actuators]]
- [[eda-fundamentals]]
