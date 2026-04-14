---
description: "The TB6612's 13.5V motor supply ceiling locks out 24V and 36V motors, forcing selection of the less-efficient L298N (46V max) despite the Darlington's heat and loss penalty — efficiency and voltage range are independent axes, and the motor's own voltage rating decides which axis dominates"
type: claim
source: "docs/parts/osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[shields]]"
related_components:
  - "osepp-tb6612-motor-shield"
  - "l298n-dual-h-bridge-motor-driver"
---

# TB6612 motor supply ceiling of 13.5V is a hard selection boundary against L298N for 24V and 36V motor systems

The TB6612 motor supply (VM) is specified 4.5V to 13.5V. Exceeding this kills the chip — there is no thermal graceful-degradation path, just immediate destruction from overvoltage across the MOSFET drains. The L298N handles up to 46V on the motor supply. This means the choice between these two drivers is NOT a simple "TB6612 is better because MOSFET efficiency" — it is a segmented decision where motor supply voltage decides the answer before efficiency enters the discussion.

The inventory contains 12V motors (within TB6612 range) and hoverboard-class 36V systems (far above it). The 12V motors benefit from TB6612 efficiency. The 36V systems have no choice but a driver rated for 46V or higher — which in this inventory means the L298N (2A) or the RioRand ZS-X11H BLDC controller (60V, 16A). There is no intermediate option.

**The selection rule becomes a decision tree, not a ladder:**

1. First filter: does the motor's required supply voltage exceed 13.5V?
   - YES -> TB6612 is eliminated regardless of efficiency advantages
   - NO -> proceed to step 2
2. Second filter: is the motor within 1.2A continuous current?
   - YES -> choose TB6612 (efficiency wins)
   - NO -> choose L298N (2A capacity needed)

**Why the current-ladder model misleads here:** [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] frames selection as a smooth current progression (600mA -> 1.2A -> 2A -> 16A). That model is correct for current dimension alone, but hides the voltage ceiling discontinuity at 13.5V. A 0.5A motor running at 24V is below the TB6612's current rating but above its voltage rating — the current ladder gives no guidance here, only the two-dimensional (voltage × current) selection table does.

**Why this justifies keeping "inferior" drivers in the inventory:** The L298N is architecturally worse than the TB6612 on every metric shared by both (efficiency, heat, PWM frequency, flyback diodes). Reading [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] alone suggests the L298N is obsolete. The voltage ceiling is the reason it is not obsolete: its 46V rating covers use cases the TB6612 cannot touch. Modern high-voltage MOSFET drivers exist (DRV8871 at 45V, BTN7971 at 40V), but this inventory does not contain them — the L298N holds the 13.5V-to-46V territory by default.

**ProtoPulse implication:** The driver selection DRC must check motor supply voltage BEFORE efficiency recommendations. A BOM with a 24V motor and a TB6612 shield is an error, not an efficiency suggestion. The warning text should be "motor supply exceeds TB6612 13.5V ceiling — select L298N or ZS-X11H for 24V+ systems," not a softer efficiency hint.

---

Source: [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]

Relevant Notes:
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] — the current ladder is true but incomplete; voltage creates a second dimension
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] — the L298N's inefficiency is the price paid for its voltage range
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] — voltage tiers force the driver selection; drivers do not choose tiers
- [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]] — why the TB6612 wins when voltage permits

Topics:
- [[actuators]]
- [[power-systems]]
- [[shields]]
