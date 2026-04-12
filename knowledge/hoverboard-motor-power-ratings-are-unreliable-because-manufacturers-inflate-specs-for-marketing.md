---
description: "The same physical hoverboard motor is listed as 250W, 350W, or 500W by different sellers -- use 250W continuous / 350W peak as the conservative design-safe interpretation"
type: claim
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# hoverboard motor power ratings are unreliable because manufacturers inflate specs for marketing

Hoverboard motor manufacturers are notoriously loose with ratings. The same physical motor -- identical stator, identical magnets, identical windings -- may be listed as 250W, 350W, or even 500W depending on the seller. This is not fraud in the strict sense; different rating methods (continuous, peak, instantaneous) give different numbers, and Chinese component sellers routinely use the most flattering interpretation.

In practice, these motors are typically rated 250W continuous and 350W peak. The "500W" rating likely refers to a momentary surge that the motor can survive but cannot sustain thermally. For project planning, the rule is: size your controller and wiring for the 350W peak (which determines worst-case current draw at ~10-15A per motor), but plan your thermal budget and continuous duty cycle around the 250W continuous figure.

This pattern extends beyond hoverboard motors. Generic Chinese components -- especially power-related ones like motors, ESCs, batteries, and power supplies -- routinely quote peak or marketing-inflated ratings. A "30A" BMS may trip at 25A sustained. A "500W" power supply may only deliver that at peak with active cooling. The defensive engineering practice is: assume the conservative continuous rating is 60-70% of the advertised number, and bench-test critical components before committing to a design.

For ProtoPulse, this means the AI bench coach should warn users when they rely on advertised specs for generic/salvaged components and suggest empirical verification. The BOM system should distinguish between "manufacturer rated" and "verified" power specifications.

---

Source: [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]

Relevant Notes:
- [[all-procurement-data-is-ai-fabricated]] -- another dimension of unreliable specs, where AI generates numbers wholesale
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- trusting inflated specs leads to undersized wiring and thermal failures
- [[salvaged-generic-components-have-no-datasheets-so-specs-must-be-determined-empirically]] -- spec inflation compounds the no-datasheet problem

Topics:
- [[actuators]]
- [[eda-fundamentals]]
