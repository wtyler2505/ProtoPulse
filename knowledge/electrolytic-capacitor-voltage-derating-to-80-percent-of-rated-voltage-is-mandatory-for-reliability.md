---
description: "Operating an electrolytic capacitor near its rated voltage accelerates electrolyte degradation and oxide breakdown -- derating to 80% (e.g., 160V max for a 200V cap) is the standard reliability practice for designs intended to last"
type: knowledge-note
source: "docs/parts/200mxr470m-electrolytic-capacitor-470uf-200v-radial.md"
topics:
  - "[[passives]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# Electrolytic capacitor voltage derating to 80 percent of rated voltage is mandatory for reliability

Aluminum electrolytic capacitors have a rated voltage that represents the maximum continuous DC voltage the dielectric oxide layer can withstand. However, operating at this maximum accelerates two degradation mechanisms:

1. **Oxide stress** -- the aluminum oxide dielectric layer is grown electrochemically to a thickness proportional to the formation voltage. Operating at rated voltage keeps the oxide at its stress limit, where minor defects or temperature excursions can cause localized breakdown
2. **Electrolyte decomposition** -- higher voltage increases leakage current, which generates internal heat, which accelerates electrolyte evaporation through the seal

**The 80% rule:** Derate to no more than 80% of rated voltage for designs intended to be reliable. For a 200V-rated cap, the maximum operating voltage should be 160V. For a 50V-rated cap, limit to 40V.

| Rated Voltage | 80% Derated | Common Application |
|--------------|-------------|-------------------|
| 16V | 12.8V | 12V battery systems |
| 25V | 20V | 5V systems (generous margin) |
| 50V | 40V | 24V industrial or 12V with headroom |
| 200V | 160V | Offline SMPS, rectified mains |
| 400V | 320V | Full-wave rectified 230V mains |

**The beginner trap:** Selecting a capacitor with a voltage rating equal to the expected operating voltage. A 12V system needs at least a 16V cap (for the 80% rule), and preferably a 25V cap (for additional margin against transients).

**ProtoPulse DRC implication:** When a capacitor's operating voltage exceeds 80% of its rated voltage, flag it as a reliability concern and suggest a higher voltage rating.

---

Relevant Notes:
- [[every-10c-above-rated-temperature-halves-aluminum-electrolytic-capacitor-lifespan]] -- Temperature derating compounds with voltage derating
- [[ripple-current-rating-is-the-hidden-selection-constraint-for-electrolytic-capacitors-in-power-supply-filtering]] -- A third derating dimension beyond voltage and temperature

Topics:
- [[passives]]
- [[power-systems]]
