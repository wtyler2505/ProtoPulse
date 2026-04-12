---
description: "A BMS from a salvaged hoverboard has undocumented overcurrent, undervoltage, and thermal cutoff thresholds that may not match expectations -- empirical verification is mandatory before relying on it for protection"
type: claim
source: "docs/parts/hoverboard-10s-lithium-ion-battery-pack-36v-with-bms.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hoverboard-10s-battery-pack"
---

# Salvaged BMS has unknown thresholds and must be verified before trusting with project safety

A hoverboard battery management system (BMS) is a protection circuit board wired to each cell group in the pack. It provides five protection functions: overcharge, over-discharge, overcurrent, short-circuit, and thermal shutdown. On a salvaged pack with no datasheet, every one of these thresholds is unknown.

**The verification protocol (test each before relying on it):**

1. **Open-circuit voltage:** Measure pack voltage with no load. Below 30V indicates possible cell damage -- proceed with extreme caution. Below 25V (2.5V/cell), cells are likely permanently degraded and should not be recharged.

2. **Overcharge cutoff:** Charge with a 42V charger and verify the BMS disconnects charging at or before 42V. If the BMS doesn't cut off, the charger's CC/CV profile is the only protection -- and cheap chargers may overshoot.

3. **Over-discharge cutoff:** Discharge through a known resistive load while monitoring voltage. Verify BMS disconnects at approximately 30V (3.0V/cell). The actual threshold might be lower (2.8V/cell on some cheap BMS boards), which allows cell damage before protection activates.

4. **Cell balance:** If cell taps are accessible, measure individual cell voltages. Any cell more than 0.1V different from the others indicates imbalance. Most hoverboard BMS boards use passive balancing (bleeding higher cells through small resistors) during charge -- it's slow and may never fully equalize badly imbalanced cells.

5. **Physical inspection:** Check for swelling (puffy cells), discoloration, or electrolyte odor (sweet chemical smell). Any of these means the pack is unsafe regardless of electrical measurements.

**Why salvaged BMS is fundamentally less trustworthy than new:**
- The BMS may have been designed for a 2-motor hoverboard's current draw (~20A peak) and will trip prematurely on a 4-motor rover (~60A peak)
- Component aging: MOSFETs and protection ICs degrade, and the BMS may have absorbed prior overcurrent events that damaged its protection circuitry without visible signs
- Unknown thermal sensor placement: the BMS temperature sensor may be on the PCB itself (measuring board temp, not cell temp) or may be missing entirely

---

Relevant Notes:
- [[salvaged-generic-components-have-no-datasheets-so-specs-must-be-determined-empirically]] -- the BMS is the highest-stakes example of "test first, trust never"
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] -- the 4-motor overcurrent scenario that a 2-motor BMS cannot handle

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
