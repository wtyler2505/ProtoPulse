---
description: "MB V2 breadboard power module lets you run 3.3V ESP32 on one rail and 5V Arduino on the other from one module -- eliminates separate supplies for dual-voltage prototyping"
type: claim
source: "docs/parts/elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "mb-v2-power-module"
  - "ams1117"
---

# Independent per-rail voltage selection enables mixed-voltage breadboard prototyping without isolation circuits

The Elegoo MB V2 breadboard power module has a separate jumper for each of the two power rails on an MB-102 breadboard. This means you can independently set one rail to 3.3V and the other to 5V, powering a 3.3V ESP32 circuit on one side and a 5V Arduino circuit on the other from a single module and a single barrel jack input.

This is a prototyping pattern worth naming because the alternative is either two separate power supplies, a level-shifted power domain, or running everything at 5V and hoping nothing dies. For the OmniTrek rover breadboard prototyping phase -- where both the ESP32 (3.3V) and the Mega (5V) may coexist on the same bench -- the independent rail selection eliminates an entire class of "I forgot which rail is which voltage" errors.

The underlying regulators are AMS1117-3.3 and AMS1117-5.0 -- the same silicon family used on ESP32 dev boards and many Arduino clones. This shared lineage means the thermal and current limitations are identical: ~800mA total across both rails combined, linear regulation heat.

**ProtoPulse implication:** When the BOM includes both 3.3V and 5V dev boards for the same breadboard, the AI should suggest a dual-voltage power module configuration and warn about the shared current budget.

---

Relevant Notes:
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] -- same AMS1117 regulator family with same ~800mA thermal ceiling
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- breadboard power module covers the low-voltage logic tier only
- [[breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power]] -- the current limit that defines what this module can and cannot do

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
