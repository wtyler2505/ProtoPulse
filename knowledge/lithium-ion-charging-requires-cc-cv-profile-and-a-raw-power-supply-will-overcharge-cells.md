---
description: "Lithium-ion cells require a two-phase charging protocol (constant current then constant voltage at 4.2V/cell) -- a bench power supply set to 42V provides constant voltage only, risking overcharge current that the BMS may not catch fast enough"
type: claim
source: "docs/parts/hoverboard-10s-lithium-ion-battery-pack-36v-with-bms.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hoverboard-10s-battery-pack"
---

# Lithium-ion charging requires CC/CV profile and a raw power supply will overcharge cells

Lithium-ion cells have a strict two-phase charging protocol (CC/CV -- constant current, constant voltage):

**Phase 1 -- Constant Current (CC):** The charger delivers a fixed current (typically 0.5C to 1C, so 2A-4A for a 4Ah pack) while voltage rises from whatever the pack's current state is toward 42V. This phase delivers ~80% of the charge.

**Phase 2 -- Constant Voltage (CV):** Once any cell reaches 4.2V, the charger holds 42V exactly and current tapers down. Charging is complete when current drops below ~C/20 (100-200mA for a typical pack). This phase takes 30-60 minutes and delivers the final ~20%.

**What happens with a bench power supply set to 42V:**
- The power supply skips the CC phase entirely -- it outputs 42V immediately
- Into a partially discharged pack (say 35V), the initial current is limited only by the pack's internal resistance and the PSU's current limit
- If the PSU can deliver 10A and the pack's internal resistance is 0.5 ohms, initial current could be 14A -- far exceeding the cell's safe charge rate
- The BMS may have overcurrent protection, but its trip time (milliseconds to seconds) may not prevent localized heating
- Even if current-limited to a safe rate, the PSU has no "taper" phase -- it will try to force 42V indefinitely, and cell voltage measurement accuracy at the BMS becomes the sole protection against overcharge

**The correct solution:** Use a purpose-built lithium-ion charger designed for 10S packs (42V output, CC/CV profile). The original hoverboard charger (typically 42V, 1.5-2A) is ideal. Generic 42V lithium chargers from the RC hobby market also work but verify the cell count matches (10S, not 12S).

**The temperature constraint is equally important:** Never charge below 0C (lithium plating on anode, permanent capacity loss and internal short-circuit risk) or above 45C (accelerated degradation and thermal runaway risk). Most chargers don't monitor pack temperature -- the BMS thermal sensor (if present) is the only protection.

---

Relevant Notes:
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] -- the 42V maximum that the charger must not exceed
- [[salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety]] -- the BMS whose overcharge protection you're relying on

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
