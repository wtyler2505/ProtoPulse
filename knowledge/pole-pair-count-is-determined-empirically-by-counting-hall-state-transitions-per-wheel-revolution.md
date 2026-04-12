---
description: "One full wheel rotation produces (6 x pole_pairs) Hall state changes -- connect Hall outputs to Arduino digital pins and count transitions to characterize salvaged motors with no datasheet"
type: claim
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[breadboard-intelligence]]"
  - "[[eda-fundamentals]]"
---

# pole pair count is determined empirically by counting hall state transitions per wheel revolution

For salvaged BLDC motors with no datasheet (the default for hoverboard motors), the pole pair count must be determined empirically. The technique is simple: connect the three Hall sensor outputs to Arduino digital pins, slowly rotate the wheel by hand, and count the total number of Hall state transitions in one complete mechanical revolution.

The formula: `pole_pairs = total_transitions / 6`

Each electrical revolution produces exactly 6 Hall state transitions (the 6-step commutation sequence). The number of electrical revolutions per mechanical revolution equals the number of pole pairs. So:

| Transitions counted | Pole pairs | Magnets (2x pole pairs) |
|--------------------|------------|------------------------|
| 60 | 10 | 20 |
| 90 | 15 | 30 |
| 120 | 20 | 40 |

Hoverboard motors commonly have 10 or 15 pole pairs. The motors in Tyler's inventory have 15 pole pairs (90 transitions per revolution, 30 magnets).

**Why pole pair count matters for the controller:**
- It determines the ratio between electrical and mechanical degrees (120 electrical degrees = 120/pole_pairs mechanical degrees)
- It affects the maximum RPM at a given voltage (KV rating is inversely related to pole pairs)
- Some BLDC controllers need the pole pair count as a configuration parameter for speed calculation and current limiting
- Position resolution from Hall sensors improves with more pole pairs (6 degrees electrical per state change = 4 degrees mechanical with 15 pole pairs vs 6 degrees with 10)

**For ProtoPulse bench coach:** When a user adds a BLDC motor with unknown specs, the AI should guide them through this pole-pair counting procedure before attempting to configure the controller. Getting the pole pair count wrong may cause incorrect speed readings and current limit calculations.

---

Source: [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]

Relevant Notes:
- [[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]] -- the 6-step Gray code that this counting technique depends on
- [[hall-sensor-wiring-order-matters-for-bldc]] -- Hall outputs must be wired correctly before counting makes sense
- [[salvaged-generic-components-have-no-datasheets-so-specs-must-be-determined-empirically]] -- pole pair counting is one specific instance of the general pattern

Topics:
- [[actuators]]
- [[breadboard-intelligence]]
- [[eda-fundamentals]]
