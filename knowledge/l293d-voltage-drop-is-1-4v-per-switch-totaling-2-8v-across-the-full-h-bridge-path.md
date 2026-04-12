---
description: "Each L293D output transistor drops ~1.4V at rated current, and since the H-bridge has two in series (high-side + low-side), a 6V motor effectively gets only ~3.2V -- this is better than the L298N's 4.9V drop but still significant for low-voltage motors"
type: claim
source: "docs/parts/l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# l293d voltage drop is 1-4v per switch totaling 2-8v across the full h-bridge path

The L293D uses Darlington transistor pairs in its H-bridge, similar in architecture to the L298N but at lower current. Each output transistor drops approximately 1.4V (collector-emitter saturation voltage) at rated current. Since current flows through TWO transistors in an H-bridge (one high-side, one low-side), the total voltage lost to the driver is ~2.8V.

**The practical consequence:** A motor connected to a 6V supply through an L293D receives only ~3.2V. A 5V motor supply delivers only ~2.2V to the motor. This makes the L293D problematic for very low voltage motors (3V-6V range) where the 2.8V drop represents 47-93% of the supply.

**Comparison with the family:**

| Driver | Drop (total path) | At 12V supply | Effective motor voltage |
|--------|-------------------|---------------|------------------------|
| L293D | ~2.8V | 12V | ~9.2V (77% efficient) |
| L298N | ~4.9V at 2A | 12V | ~7.1V (59% efficient) |
| TB6612FNG | ~0.5V | 12V | ~11.5V (96% efficient) |

The L293D is better than the L298N (2.8V vs 4.9V drop) because it operates at lower current where saturation voltage is lower, but still significantly worse than MOSFET-based drivers. The difference between the L293D's 2.8V and the L298N's 4.9V is primarily because the L298N is being pushed to 2A while the L293D is rated for 600mA -- at equivalent currents, the underlying Darlington architecture performs similarly.

**When this matters most:** At motor supply voltages below 9V, the 2.8V drop becomes a dominant factor. A beginner using 4xAA batteries (6V nominal, 4.8V depleted) through an L293D is delivering barely above stall voltage to a motor designed for 6V. The motor will be slow and weak, and the batteries will deplete faster because efficiency is poor.

**ProtoPulse implication:** The BOM validation should calculate and display effective motor voltage after driver drop, warning when it falls below 60% of the motor's rated voltage.

---

Source: [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]

Relevant Notes:
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] -- same Darlington architecture problem at higher current
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] -- the TB6612 sits between L293D and L298N in current but far exceeds both in efficiency
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- low-voltage motors (5V tier) are most affected by driver voltage drops

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
