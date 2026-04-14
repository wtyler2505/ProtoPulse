---
description: "Setting both H-bridge inputs HIGH shorts the motor terminals through the driver (dynamic brake / fast stop), while both LOW disconnects the motor (coast / free run) -- choosing wrong affects robot behavior and driver stress"
type: claim
source: "docs/parts/l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# h-bridge brake and coast are distinct stop modes that beginners conflate

The L298N H-bridge truth table reveals four motor states, but beginners typically only use two (forward and reverse) and treat "stop" as a single concept. It is not.

| EN | IN1 | IN2 | Motor Action | What Happens Electrically |
|----|-----|-----|-------------|--------------------------|
| H  | H   | L   | Forward | Current flows A->motor->B |
| H  | L   | H   | Reverse | Current flows B->motor->A |
| H  | H   | H   | Brake (fast stop) | Both motor terminals shorted to VS through high-side transistors |
| H  | L   | L   | Coast (free run) | Both motor terminals shorted to GND through low-side transistors |
| L  | X   | X   | Disabled | Motor terminals floating, same as coast |

**Brake** creates a short circuit across the motor terminals through the driver. The motor's back-EMF drives current through this short, converting kinetic energy to heat in the motor windings and driver. The motor stops quickly -- essential for precise positioning in robotics.

**Coast** effectively disconnects the motor. It spins down gradually under friction alone. In a rover, this means the vehicle continues rolling after "stopping," which may or may not be desired.

**Why this matters for robotics:**
- A line-following robot needs brake mode to stop precisely at a line
- A rover on a slope needs brake mode or it will roll
- Coast mode reduces driver stress and heat during PWM off-cycles
- Aggressive braking at high current can stress the driver thermally

Since [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] applies to BLDC motors, the same thermal concern exists for brushed DC motors during sustained brake: holding brake while the motor is spinning fast dumps significant energy as heat. For the L298N specifically, since [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]], brake mode at high current adds even more thermal stress to an already thermally challenged driver.

**The TB6612 adds a fifth state beyond the four in this table:** pulling STBY LOW enters a true sleep mode (< 1uA quiescent) that is distinct from coast — coast holds outputs LOW with the driver still powered, while standby powers down the entire IC. See [[tb6612-standby-pin-adds-a-fifth-motor-state-below-brake-and-coast-with-sub-microamp-quiescent-current]] for the extended state hierarchy. The L298N has no equivalent state because Darlington bias circuits cannot be meaningfully quiesced.

**ProtoPulse implication:** The AI bench coach should explain brake vs coast when a user connects motor stop logic, and the code generation tool should offer both modes with comments explaining the tradeoff.

---

Source: [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- the truth table is the brushed DC motor control paradigm in detail
- [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] -- brake thermal limits apply to brushed DC motors too, not just BLDC
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] -- the thermal penalty of brake mode is amplified by the high saturation voltage

Topics:
- [[actuators]]
- [[eda-fundamentals]]
