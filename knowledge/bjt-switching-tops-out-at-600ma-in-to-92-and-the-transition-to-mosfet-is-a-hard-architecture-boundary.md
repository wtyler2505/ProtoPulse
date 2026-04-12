---
description: "BJTs in TO-92 (PN2222A, S8050) are limited to ~600mA by package thermal and die current ratings -- above this threshold, the switch must be a MOSFET (P30N06LE handles 30A), making this a hard design boundary, not a gradual preference"
type: knowledge-note
source: "docs/parts/pn2222a-npn-transistor-40v-600ma-general-purpose-to92.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# BJT switching tops out at 600mA in TO-92 and the transition to MOSFET is a hard architecture boundary

For MCU-driven DC load switching, there are two device families: BJTs (current-driven, base resistor required) and MOSFETs (voltage-driven, gate resistor optional). The boundary between them is not a matter of preference -- it is dictated by physics:

**BJT region (0-600mA):**
- PN2222A: 600mA max, 40V, hFE 100-300, TO-92
- S8050: 500mA max, 25V, hFE 40-400, TO-92
- 2N3904: 200mA max, 40V, hFE 100-300, TO-92
- Requires: base resistor (1K-10K), base current (1-10mA from GPIO)
- Advantages: cheaper ($0.02-0.10), simpler schematic, no gate capacitance, instantly available in kits
- Limitations: current-driven (consumes GPIO current), gain-dependent (hFE varies 3x), TO-92 thermal limit (625mW)
- Vce(sat) varies by device: PN2222A ~0.3V, S8050 ~0.6V at rated current -- this 2x difference affects thermal calculations in the overlap zone (see [[s8050-vce-saturation-voltage-is-double-that-of-pn2222a-at-equivalent-current-making-it-dissipate-twice-the-switching-power]])

**MOSFET region (600mA-30A+):**
- P30N06LE: 30A max, 60V, Rds(on) 35mOhm, TO-220
- IRLZ44N: 47A max, 55V, Rds(on) 22mOhm, TO-220
- Requires: pull-down resistor (10K gate-source), optionally gate resistor for EMI
- Advantages: voltage-driven (essentially zero GPIO current), no gain calculation, handles massive currents, TO-220 dissipates 50W+
- Limitations: gate capacitance causes switching transients, logic-level MOSFETs required for 3.3V/5V GPIO drive

**Why this is a hard boundary, not gradual:**

1. **No TO-92 BJT exceeds 1A.** The package simply cannot dissipate enough heat. Pushing a PN2222A to its 600mA limit is already risky without confirming saturation.

2. **MOSFETs are overkill below 200mA.** The gate capacitance, PCB layout concerns, and pull-down resistor requirement add complexity that a simple BJT + base resistor avoids.

3. **The overlap zone (200-600mA) is where selection matters.** Both work, but BJTs are simpler for one-off switching while MOSFETs are better for PWM at higher frequencies (no storage time delay).

**ProtoPulse DRC rule:** When a load exceeds 600mA, reject BJT selection and recommend MOSFET. When a load is under 100mA, suggest BJT for simplicity. In between, present both options with trade-offs.

---

Source: [[pn2222a-npn-transistor-40v-600ma-general-purpose-to92]]

Relevant Notes:
- [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] -- the MOSFET topology that takes over above 600mA
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] -- what makes MOSFETs directly GPIO-drivable
- [[to-92-package-limits-power-dissipation-to-625mw-and-requires-derating-above-25c-making-thermal-math-mandatory-for-high-current-switching]] -- the thermal reason for the 600mA boundary

Topics:
- [[passives]]
- [[eda-fundamentals]]
