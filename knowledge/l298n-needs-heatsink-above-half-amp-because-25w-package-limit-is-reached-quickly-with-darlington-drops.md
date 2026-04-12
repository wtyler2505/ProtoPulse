---
description: "The L298N's 25W max dissipation at Tcase=75C is consumed rapidly because Darlington saturation voltage causes watts-level waste even at moderate current -- at 2A per channel the IC needs bolted aluminum heatsinking or it will thermally shut down or fail"
type: claim
source: "docs/parts/l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# l298n needs heatsink above half amp because 25w package limit is reached quickly with darlington drops

The L298N's Multiwatt15 package has a maximum power dissipation of 25W, but only when the case temperature is held at 75C or below. The tab (pin 8, GND) is the thermal path -- it must be bolted to an aluminum heatsink with thermal compound for the rating to apply. Without a heatsink, the effective dissipation limit drops to a few watts based on the junction-to-ambient thermal resistance alone.

**The math that matters:**

Power dissipated = V_sat * I_load (per channel, two channels max)

| Current (per channel) | V_sat (total drop) | Power per channel | Both channels | Heatsink needed? |
|-----------------------|-------------------|-------------------|---------------|-----------------|
| 0.25A | ~0.9V | 0.2W | 0.4W | No |
| 0.5A | ~1.2V | 0.6W | 1.2W | Marginal -- gets warm |
| 1.0A | ~1.8V | 1.8W | 3.6W | Yes |
| 1.5A | ~3.2V | 4.8W | 9.6W | Definitely yes |
| 2.0A | ~4.9V | 9.8W | 19.6W | Large heatsink mandatory |

At 2A on both channels simultaneously, the IC dissipates nearly 20W -- close to the absolute maximum even with a heatsink. This is why the L298N gets "VERY hot" as the source warns. The operating temperature range of -25 to 130C for the junction gives limited headroom.

**Practical heatsink guidance:** The standard red L298N module from typical suppliers includes a small aluminum heatsink pre-attached to the tab, but it is often inadequate for sustained loads above 1A. For higher currents, bolt the module to a larger aluminum plate or use a finned heatsink with forced air cooling.

Since [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]], the thermal problem and the efficiency problem are the same root cause -- the Darlington transistor architecture. MOSFET-based drivers solve both simultaneously.

---

Source: [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]

Relevant Notes:
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] -- voltage drop IS the heat source; both are Darlington consequences
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] -- the 2A rating is a thermal rating as much as an electrical one

Topics:
- [[actuators]]
- [[eda-fundamentals]]
