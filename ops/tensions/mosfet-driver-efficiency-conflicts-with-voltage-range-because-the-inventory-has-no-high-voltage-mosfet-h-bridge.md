---
description: "TB6612 dominates L298N on efficiency, heat, PWM frequency, and flyback protection — but the L298N's 46V ceiling covers motor supply ranges the TB6612 (13.5V max) cannot touch, creating a selection tension where no inventory part wins both axes above 13.5V"
type: tension
source: "docs/parts/osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel.md"
observed_date: 2026-04-14
category: driver-selection
status: active
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[shields]]"
---

# MOSFET driver efficiency conflicts with voltage range because the inventory has no high-voltage MOSFET H-bridge

## Quick Test

Given a 24V DC motor drawing 1.5A continuous, which driver wins?

If the answer is "TB6612 is more efficient, choose it" — STOP. The TB6612 caps at 13.5V. Answer is wrong, destructively so. If the answer is "L298N handles 46V, choose it" — also incomplete. The L298N loses ~3.5V as heat at 1.5A per channel, demands heatsinking, and requires external flyback diodes. Both answers are partial. The tension is real.

## When Each Pole Wins

| Motor Supply Voltage | Current (per channel) | Winner | Why |
|----------------------|----------------------|--------|-----|
| 4.5-13.5V | < 1.2A | TB6612 | Dominates on every axis: efficiency, heat, PWM frequency, flyback |
| 4.5-13.5V | 1.2-2A | L298N | TB6612 is eliminated by current; L298N's penalties become the cost of capacity |
| 13.5-46V | any | L298N | TB6612 is eliminated by voltage; L298N inefficiency is accepted because no alternative exists in inventory |
| > 46V | BLDC only | ZS-X11H | Off the H-bridge map entirely — requires BLDC architecture |

The TB6612 dominates only in the bottom-left quadrant. Outside it, the L298N wins by default — not because it is architecturally superior (it is not — see [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]]) but because the inventory has no high-voltage MOSFET H-bridge alternative.

## Dissolution Attempts

**Could this be dissolved by adding a high-voltage MOSFET driver?** Yes, in principle. Parts like the DRV8871 (45V, 3.6A, MOSFET) or BTN7971 (40V, 70A, MOSFET half-bridge) would cover the 13.5-46V range with MOSFET efficiency. The tension is inventory-scoped, not fundamental. Adding a DRV8871 breakout would move the dominance boundary up from 13.5V to 45V, leaving only the 46V+ gap where the L298N still has a role.

**Could this be dissolved by restricting the inventory to < 13.5V systems?** Partially. Hoverboard motors at 36V and typical robotics applications around 24V are common enough that restricting the voltage range would exclude major use cases. This is rejection of the tension by limiting scope, not dissolution.

**Could this be dissolved by always recommending the L298N?** No. Below 1.2A on < 13.5V systems, the TB6612's efficiency advantage (96% vs 59%) directly affects battery life, heat, and motor speed under load. Defaulting to L298N discards measurable performance.

## Practical Applications

The tension shapes driver selection logic in the BOM validator:

1. FIRST filter by motor voltage: if > 13.5V, TB6612 is unavailable regardless of other criteria.
2. SECOND filter by current: if > 1.2A, TB6612 is unavailable regardless.
3. THIRD (efficiency advice): if both filters permit TB6612, RECOMMEND it over L298N.
4. FOURTH (inventory gap warning): if the filters force L298N selection for < 1A at 24V, surface "this driver is oversized for efficiency; a DRV8871 or similar high-voltage MOSFET driver would be better — consider adding one to the inventory."

## Related Notes

- [[tb6612-motor-supply-ceiling-of-13-5v-is-a-hard-selection-boundary-against-l298n-for-24v-and-36v-motor-systems]] — the mechanism creating the tension
- [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]] — the efficiency pole
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] — one-dimensional view that hides this tension
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] — voltage tiers are the axis the tension operates along
- [[combo-motor-and-servo-shields-trade-per-function-efficiency-for-single-board-convenience]] — different efficiency-vs-integration tension at the shield level

---

Topics:
- [[actuators]]
- [[power-systems]]
- [[shields]]
