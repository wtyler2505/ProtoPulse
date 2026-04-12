---
description: "Enable pins (EN12, EN34) accept PWM for speed control while input pins (1A-4A) set direction with digital HIGH/LOW -- this architectural separation means speed and direction are independently controlled on different Arduino pins"
type: claim
source: "docs/parts/l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# l293d separates speed control on enable pins from direction control on input pins

The L293D's pin architecture cleanly separates two motor control dimensions across different pin groups:

- **Enable pins (EN12, EN34)**: Control whether the outputs are active. PWM on these pins varies the average voltage to the motor = speed control. Tie HIGH for always-on (full speed). One enable controls two outputs (a channel pair for one motor).
- **Input pins (1A, 2A, 3A, 4A)**: Set the logic state of each output. The input-to-output mapping determines current direction through the motor = direction control.

This separation has a practical wiring consequence: speed control requires a **PWM-capable** Arduino pin connected to the enable, while direction requires only **digital** pins connected to the inputs. On an Arduino Uno, PWM pins (3, 5, 6, 9, 10, 11) are limited to 6 -- dedicating 2 to motor speed leaves 4 for other PWM needs (servos, LED dimming). Direction pins can use any of the remaining digital I/O.

**The full control truth table for one motor (using channels 1,2):**

| EN12 | 1A | 2A | Motor Behavior |
|------|----|----|----------------|
| PWM | H | L | Forward at PWM% speed |
| PWM | L | H | Reverse at PWM% speed |
| H | H | H | Brake (both outputs HIGH) |
| H | L | L | Coast (both outputs LOW) |
| L | X | X | Off (high impedance) |

**Why beginners get confused:** Many tutorials connect enable to 5V (always on) and use PWM on the input pins instead. This "works" for speed control but produces different behavior -- when the input PWM is LOW, the output goes LOW (not high-impedance), which means the motor brakes during the OFF portion of each PWM cycle rather than coasting. This produces more audible motor whine and slightly different speed characteristics. The correct approach (PWM on enable) gives cleaner coast-during-off behavior.

Since [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]], the L293D's enable/input separation is specific to this IC family. The TB6612 uses a similar enable + direction + PWM architecture but with a dedicated PWM input pin per channel. Stepper drivers (A4988) use step + direction pins -- a completely different paradigm.

---

Source: [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- the enable/input paradigm is brushed DC motor specific
- [[h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate]] -- the truth table's brake vs coast distinction plays out differently depending on where PWM is applied
- [[uno-20ma-per-pin-200ma-total-means-no-direct-led-or-motor-drive]] -- the Arduino pins connected to L293D inputs/enables draw negligible current from GPIO

Topics:
- [[actuators]]
- [[eda-fundamentals]]
