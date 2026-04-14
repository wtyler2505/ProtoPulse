---
description: "Four motor shields in the inventory form a clear current ladder (600mA → 1.2A → 2A → 16A) that maps directly to the actuator voltage tiers -- matching load to shield is a graduated selection, not a compatibility puzzle"
type: insight
source: "docs/parts/shields.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[actuators]]"
  - "[[power-systems]]"
related_components:
  - "dk-electronics-hw-130-motor-shield"
  - "osepp-tb6612-motor-shield"
  - "osepp-motor-servo-shield-v1"
  - "riorand-zs-x11h-bldc-controller"
---

# motor shield current ratings form a graduated selection ladder

The inventory contains four motor drive options that form an unambiguous current ladder:

| Shield/Controller | Driver IC | Architecture | Current/Channel | Voltage | V-drop (total path) | Target Load |
|-------------------|-----------|--------------|-----------------|---------|---------------------|-------------|
| HW-130 | L293D | Bipolar Darlington | 600mA | 4.5-36V | ~2.8V | Small hobby motors, 28BYJ-48 |
| OSEPP TB6612 | TB6612FNG | MOSFET | 1.2A | 4.5-13.5V | ~0.5V | Medium DC motors, robotics |
| OSEPP Motor/Servo | L298N (MOSFET-enhanced) | Bipolar Darlington | 2A | 4.5-46V | ~4.9V at 2A | Larger DC motors + servos |
| RioRand ZS-X11H | Custom BLDC | MOSFET | 16A | 6-60V | ~0.1V | Hoverboard/BLDC motors |

The architecture column exposes a crucial second dimension the current ladder alone hides: the TB6612 is MOSFET-based while the L293D and L298N use bipolar Darlington transistors. Same current ladder position does NOT mean same efficiency — see [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]] for why this matters. Within overlapping current ranges (e.g., 0.8A on either TB6612 or L298N), the MOSFET choice runs cooler, faster, and with better battery life despite both options appearing valid on the current axis.

This isn't a compatibility puzzle -- it's a graduated selection where the actuator's stall current determines which tier you need. The rule is simple: pick the shield whose per-channel current rating exceeds your motor's stall current by at least 20%.

The gap between 2A (OSEPP Motor/Servo) and 16A (ZS-X11H) is notable -- there's no mid-tier option in the inventory for motors drawing 3-10A continuous. This gap corresponds to medium-duty DC gearmotors and smaller steppers that would need an external driver board rather than a shield-form-factor solution.

**Why the bottom rung is narrower than it looks:** The 600mA HW-130 tier is not a general-purpose "small DC motor" tier -- most geared DC hobby motors have stall currents of 1-2A at 6V (higher at true stall), which already exceed the L293D's 600mA continuous rating. The HW-130 tier is really a "very small hobby motors + 28BYJ-48 stepper" tier, and it requires verifying stall current before wiring. The ladder is graduated but not linearly forgiving -- selecting the bottom rung demands more engineering discipline than the higher rungs, because the consequences of undersizing at 600mA are thermal shutdown or outright driver destruction, whereas undersizing at 2A typically just means suboptimal top speed.

---

Relevant Notes:
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- Current ladder maps to voltage tiers
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- Driver selection also depends on motor type (DC vs BLDC vs stepper)
- [[combo-motor-and-servo-shields-trade-per-function-efficiency-for-single-board-convenience]] -- the 2A tier (OSEPP Motor/Servo) is the combo tier, and its L298N choice is partly dictated by needing the heat-budget to support servo integration

Topics:
- [[shields]]
- [[actuators]]
- [[power-systems]]
