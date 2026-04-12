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

| Shield/Controller | Driver IC | Current/Channel | Voltage | Target Load |
|-------------------|-----------|-----------------|---------|-------------|
| HW-130 | L293D | 600mA | 4.5-36V | Small hobby motors, 28BYJ-48 |
| OSEPP TB6612 | TB6612FNG | 1.2A | 4.5-13.5V | Medium DC motors, robotics |
| OSEPP Motor/Servo | L298N (MOSFET-enhanced) | 2A | 4.5-46V | Larger DC motors + servos |
| RioRand ZS-X11H | Custom BLDC | 16A | 6-60V | Hoverboard/BLDC motors |

This isn't a compatibility puzzle -- it's a graduated selection where the actuator's stall current determines which tier you need. The rule is simple: pick the shield whose per-channel current rating exceeds your motor's stall current by at least 20%.

The gap between 2A (OSEPP Motor/Servo) and 16A (ZS-X11H) is notable -- there's no mid-tier option in the inventory for motors drawing 3-10A continuous. This gap corresponds to medium-duty DC gearmotors and smaller steppers that would need an external driver board rather than a shield-form-factor solution.

---

Relevant Notes:
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- Current ladder maps to voltage tiers
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- Driver selection also depends on motor type (DC vs BLDC vs stepper)

Topics:
- [[shields]]
- [[actuators]]
- [[power-systems]]
