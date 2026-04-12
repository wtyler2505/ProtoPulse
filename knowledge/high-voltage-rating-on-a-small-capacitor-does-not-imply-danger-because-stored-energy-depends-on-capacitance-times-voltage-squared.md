---
description: "A 75nF/400V film cap stores only 6mJ despite its 400V rating -- 1500x less energy than a 470uF/200V electrolytic at 9.4J -- because E=0.5CV^2 and four orders of magnitude less capacitance overwhelms twice the voltage; safety warnings should key on stored energy, not voltage rating alone"
type: knowledge-note
source: "docs/parts/753j-400v-polyester-film-capacitor-75nf.md"
topics:
  - "[[passives]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# High voltage rating on a small capacitor does not imply danger because stored energy depends on capacitance times voltage squared

The energy stored in a capacitor is `E = 0.5 x C x V^2`. This formula has a counterintuitive consequence: a small capacitor at high voltage can store negligible energy, while a large capacitor at modest voltage can be lethal.

**Concrete comparison from inventory:**

| Part | Capacitance | Voltage | Stored Energy | Danger Level |
|------|-------------|---------|---------------|-------------|
| 753J film cap | 75nF (0.000000075 F) | 400V | 0.006 J (6 mJ) | Imperceptible |
| CDE 381LX electrolytic | 100uF (0.0001 F) | 450V | 10.1 J | Potentially lethal |
| Rubycon 200MXR470M | 470uF (0.00047 F) | 200V | 9.4 J | Potentially lethal |

The film cap's voltage rating is TWICE the electrolytic's, yet it stores 1500x LESS energy. This is because capacitance differs by a factor of 6000 (470uF vs 75nF), which completely dominates the V^2 term.

**Why this matters for ProtoPulse safety warnings:**

A naive DRC rule that triggers safety warnings on any component rated above 50V would flag the 75nF/400V film cap at the same severity as a 470uF/200V electrolytic. This creates alert fatigue -- the user learns to ignore capacitor warnings because most of them are false alarms on small film caps used in snubber and EMI filter applications.

**Better safety rule:** Calculate stored energy `E = 0.5 x C x V^2` and trigger warnings at thresholds:
- **< 0.1 J:** No safety concern. Most film caps and small ceramics.
- **0.1 - 1 J:** Noticeable shock. Warn about discharge.
- **1 - 10 J:** Painful/dangerous. Mandatory discharge procedure.
- **> 10 J:** Potentially lethal. Full safety protocol with discharge, re-check, and bleeder resistor.

**The circuit context caveat:** While a 400V film cap itself is harmless, its PRESENCE in a circuit indicates 400V is present somewhere. Other components in the same circuit (large electrolytics, transformer secondaries) may store dangerous energy. The film cap is safe; its neighbors may not be.

---

Source: [[753j-400v-polyester-film-capacitor-75nf]]

Relevant Notes:
- [[high-voltage-capacitors-store-dangerous-energy-that-persists-after-circuit-power-off]] -- the note this tensions against; its energy table shows the dangerous end of the spectrum

Topics:
- [[passives]]
- [[power-systems]]
