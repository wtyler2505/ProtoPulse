---
description: "4-motor total peak draw (~60A) exceeds typical hoverboard BMS trip point (30-40A) -- either upgrade the BMS or implement firmware current limiting to prevent sudden shutdown"
type: claim
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
confidence: high
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# four-motor BLDC systems exceed standard hoverboard BMS ratings requiring firmware current limiting

When building a 4WD rover with four hoverboard hub motors (like OmniTrek), the total peak current draw exceeds the ratings of standard hoverboard battery management systems. The math is straightforward:

| Parameter | Per Motor | 4-Motor Total |
|-----------|-----------|---------------|
| Continuous current | 8-10A | 32-40A |
| Peak current | ~15A | ~60A |
| Continuous power | 250W | 1,000W |
| Peak power | 350W | 1,400W |

A standard hoverboard BMS is designed for a 2-motor system and typically trips at 30-40A total. Using its battery pack to drive 4 motors means the BMS will trip under peak load conditions (hill climbing, acceleration from stop, hitting obstacles), causing sudden power loss -- a dangerous condition for a rover carrying expensive electronics.

The solutions form a hierarchy:

1. **Firmware current limiting** (cheapest, least hardware change): Program the MCU to monitor total system current and throttle PWM duty cycle before the BMS trip point. Requires current sensing on the battery bus.
2. **BMS upgrade** (moderate): Replace the hoverboard BMS with a higher-rated unit (60A+ continuous) designed for the actual 4-motor load. Requires matching the battery cell configuration (10S for 36V).
3. **Dual battery packs** (most headroom): Two hoverboard battery packs, each driving two motors through its own BMS. Doubles capacity and halves per-BMS current draw.

This is a system-level constraint that emerges only when you scale beyond the original hoverboard's 2-motor design. The BOM and architecture tools should flag it when a user adds more than 2 BLDC motors to a 36V system with a single battery pack.

---

Source: [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]

Relevant Notes:
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- this is the high-power tier (6-60V) where BMS sizing becomes critical
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] -- the 16A ZS-X11H is per-motor; system-level current is the sum

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
