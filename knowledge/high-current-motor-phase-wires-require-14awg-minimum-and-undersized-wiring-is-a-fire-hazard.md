---
description: "At 15A peak per motor, phase wires must be 14AWG minimum with inline 20A automotive fuse -- undersized wiring silently overheats until it catches fire"
type: claim
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[wiring-integration]]"
  - "[[eda-fundamentals]]"
---

# high-current motor phase wires require 14AWG minimum and undersized wiring is a fire hazard

When a hoverboard hub motor draws 15A peak through its three phase wires, wire gauge becomes a safety-critical decision. The minimum is 14AWG for motor phase runs; 16AWG is acceptable only for very short runs (under 6 inches). Below that, the wire heats up under sustained load, the insulation softens, and a short circuit or fire becomes a real risk -- not a theoretical one.

This is a class of error that beginners make routinely because breadboard jumper wires (22AWG, rated for ~0.5A) and standard hookup wire (20-22AWG) are what they have on hand. The jump from a 5V servo drawing 500mA to a 36V BLDC motor drawing 15A is a 30x increase in current that demands completely different wire.

**The safety stack for high-current BLDC wiring:**
1. **Phase wires:** 14AWG silicone-insulated (silicone tolerates heat better than PVC)
2. **Inline fuse:** 20A automotive blade fuse between battery and controller (per motor circuit)
3. **Strain relief:** Motor phase wires experience vibration; solder joints need protection
4. **Physical separation:** High-current runs should not bundle with signal wires (Hall sensors, I2C, SPI)
5. **Connectors:** XT60 or Anderson Powerpole for 36V battery connections; no bare twisted wires

The Hall sensor cable is the opposite problem: 5 thin signal wires (~24-26AWG) carrying milliamps. These are delicate and break at solder joints. Strain relief (hot glue, heat shrink) is mandatory immediately after connection.

**For ProtoPulse:** When the BOM includes high-current components (BLDC motors, large DC motors, heating elements), the DRC should flag wire gauge requirements and fuse sizing. A schematic showing a 15A motor connected with 22AWG wire should be an error, not a warning.

---

Source: [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]

Relevant Notes:
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- the high-power tier (6-60V) is where wire gauge becomes critical
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- undersized wiring is a costly and dangerous mistake that AI should prevent
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] -- 4-motor systems multiply the wire sizing requirement across all motor runs

Topics:
- [[actuators]]
- [[wiring-integration]]
- [[eda-fundamentals]]
