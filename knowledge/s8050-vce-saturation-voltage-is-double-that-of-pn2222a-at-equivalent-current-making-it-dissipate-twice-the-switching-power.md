---
description: "S8050 Vce(sat) is ~0.6V at 500mA versus PN2222A's ~0.3V at comparable current -- this 2x difference means S8050 dissipates twice the power in the ON state (300mW vs 150mW), consuming nearly half the TO-92's 625mW thermal budget"
type: knowledge-note
source: "docs/parts/s8050-npn-transistor-25v-500ma-medium-power-to92.md"
topics:
  - "[[passives]]"
confidence: high
verified: false
---

# S8050 Vce saturation voltage is double that of PN2222A at equivalent current making it dissipate twice the switching power

When a BJT is saturated (fully on), the voltage drop across collector-to-emitter (Vce(sat)) determines how much power the transistor wastes. This is not a negligible detail -- it directly affects the thermal budget.

**Head-to-head comparison at similar current levels:**

| Parameter | PN2222A | S8050 |
|-----------|---------|-------|
| Vce(sat) @ ~150mA | 0.3V | ~0.4V |
| Vce(sat) @ ~500mA | ~0.4V (near max Ic) | 0.6V |
| Power at 300mA | 300mA x 0.3V = 90mW | 300mA x 0.5V = 150mW |
| Power at 500mA | N/A (exceeds S8050 max) | 500mA x 0.6V = 300mW |

**Why the S8050 has higher Vce(sat):** Higher hFE (up to 400) comes from a thinner base region, but this thin base also increases the collector-emitter resistance path when saturated. It is a fundamental semiconductor trade-off: gain versus on-state resistance. The S8050 is optimized for gain (easy saturation from weak base drive), while the PN2222A is optimized for lower Vce(sat) (lower power waste when fully on).

**When this matters:**
1. **Continuous switching (LED dimming, motor drive):** The extra 150mW at 300mA is permanent dissipation that heats the TO-92 package
2. **Battery-powered circuits:** Double the switching loss = measurably shorter battery life
3. **Multiple transistors in parallel or cascade:** The losses compound across the design

**When it doesn't matter:**
- Low duty-cycle switching (relay activation once per second)
- Low-current loads (<100mA) where both Vce(sat) values are small

**ProtoPulse DRC consideration:** When the bench coach calculates power dissipation for a BJT switch, use the datasheet Vce(sat) for the selected transistor, not a generic "0.3V" assumption. The S8050 at rated current burns nearly half the TO-92's thermal budget.

---

Source: [[s8050-npn-transistor-25v-500ma-medium-power-to92]]

Relevant Notes:
- [[to-92-package-limits-power-dissipation-to-625mw-and-requires-derating-above-25c-making-thermal-math-mandatory-for-high-current-switching]] -- the thermal budget this note erodes
- [[bjt-saturation-requires-base-current-above-collector-current-divided-by-minimum-hfe-making-base-resistor-calculation-a-forced-gain-problem]] -- proper saturation minimizes Vce(sat)

Topics:
- [[passives]]
