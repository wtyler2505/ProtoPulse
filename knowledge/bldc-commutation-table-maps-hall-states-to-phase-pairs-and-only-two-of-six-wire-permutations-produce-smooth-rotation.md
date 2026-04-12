---
description: "The 6-step commutation table maps each Hall state to a specific high-side/low-side MOSFET pair -- only 2 of the 6 possible 3-wire permutations produce smooth rotation (one per direction), so wrong wiring has a 67% chance of failure"
type: claim
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
  - "[[breadboard-intelligence]]"
---

# BLDC commutation table maps hall states to phase pairs and only two of six wire permutations produce smooth rotation

The core of trapezoidal BLDC control is the commutation table: a fixed mapping from Hall sensor states to active motor phase pairs. The ZS-X11H implements the standard 6-step sequence:

| Hall A,B,C | Decimal | High-Side | Low-Side | Current Path |
|-----------|---------|-----------|----------|-------------|
| 1,0,1 | 5 | Phase A | Phase C | A -> C |
| 0,0,1 | 1 | Phase B | Phase C | B -> C |
| 0,1,1 | 3 | Phase B | Phase A | B -> A |
| 0,1,0 | 2 | Phase C | Phase A | C -> A |
| 1,1,0 | 6 | Phase C | Phase B | C -> B |
| 1,0,0 | 4 | Phase A | Phase B | A -> B |

This table is hardwired in the controller's logic. The motor's physical Hall sensor placement determines which Hall state occurs at which rotor position. For the system to work, the Hall-to-phase mapping must be consistent: when Hall state 5 occurs, the rotor must actually be in the position where driving current from Phase A to Phase C produces forward torque.

**The permutation math:** Three motor phase wires (MA, MB, MC) can be connected in 3! = 6 permutations. Only one permutation produces correct forward rotation. The reverse permutation (swapping any two wires) produces correct reverse rotation. The remaining 4 permutations produce various degrees of malfunction -- vibration, stalling, rough running, or reverse with jerking.

**The practical debugging protocol:**
1. Connect phases in any order and power on at low speed
2. If motor vibrates but doesn't rotate: swap any two motor phase wires
3. If motor runs rough or jerky: swap HA and HC Hall sensor wires (keeping HB in place)
4. This converges in at most 2-3 swaps

**Why the commutation table matters for ProtoPulse:** Since [[hall-sensor-wiring-order-matters-for-bldc]], the bench coach should present this table when a user is debugging motor behavior, and offer the systematic swap procedure rather than letting them try random permutations. The 6-step sequence is the same across all trapezoidal BLDC controllers -- only the Hall-to-phase alignment varies by motor model.

---

Source: [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md]]

Relevant Notes:
- [[hall-sensor-wiring-order-matters-for-bldc]] -- the high-level claim that this note provides the specific table and math for
- [[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]] -- the Gray code sequence that the commutation table reads
- [[pole-pair-count-is-determined-empirically-by-counting-hall-state-transitions-per-wheel-revolution]] -- this table repeats (pole_pairs) times per mechanical revolution

Topics:
- [[actuators]]
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
