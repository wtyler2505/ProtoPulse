---
description: "Combining three separate digital pin reads for BLDC Hall sensors into a single 3-bit byte via bit-shifting ensures atomic lookups and prevents the microcontroller from evaluating invalid mid-transition states."
type: claim
source: "ops/queue/wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter-049.md"
confidence: proven
topics:
  - "[[firmware]]"
  - "[[bldc-motors]]"
  - "[[microcontrollers]]"
---

# Bit-shifting Hall sensor reads into a single byte creates atomic commutation lookups preventing mid-transition race conditions

When reading the state of three Hall effect sensors (A, B, C) on a brushless DC (BLDC) motor, the canonical implementation pattern is to combine the reads into a single 3-bit state byte using bitwise operations:

```cpp
uint8_t state = (digitalRead(PIN_A) << 2) | (digitalRead(PIN_B) << 1) | digitalRead(PIN_C);
```

While this may appear to be a mere convenience for switch-statement lookups, it serves a critical race-condition prevention function. During a rotor transition from one commutation step to the next, the Hall sensors do not change state exactly simultaneously at the microsecond level.

If a microcontroller evaluates the pins sequentially and acts upon them independently, it could read a "mid-transition" state that the motor physically never occupied. By assembling the three reads into a single byte immediately, the software ensures that the subsequent commutation table lookup (mapping the 3-bit state to a specific phase pair, as seen in [[bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation]]) uses a consistent, atomic snapshot of the sensor state.

This pattern is a crucial code-level invariant for robust trapezoidal BLDC motor control.

---

Relevant Notes:
- [[bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation]]
- [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]]
