---
description: "PN2222A (40V/hFE 100-300) vs S8050 (25V/hFE 40-400) encodes a fundamental design trade-off: higher gain makes 3.3V GPIO saturation easier but lowers the maximum load voltage -- pick based on load voltage first, then GPIO voltage"
type: knowledge-note
source: "docs/parts/s8050-npn-transistor-25v-500ma-medium-power-to92.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Transistor selection trades voltage ceiling for gain and the decision boundary is load voltage plus gpio voltage

When selecting between common NPN transistors for a switching application, the two dominant parameters form a trade-off axis:

| Transistor | Vceo (max) | hFE Range | Best For |
|-----------|-----------|-----------|----------|
| PN2222A | 40V | 100-300 | Higher voltage loads, 5V GPIO |
| S8050 | 25V | 40-400 (typ 200) | Low-voltage loads, 3.3V GPIO |
| 2N3904 | 40V | 100-300 | Signal-level loads (<200mA) |

**The decision algorithm:**

```
1. Is load voltage > 25V?
   YES → PN2222A (or MOSFET if Ic > 600mA)
   NO ↓

2. Is GPIO voltage 3.3V AND load current > 50mA?
   YES → S8050 (higher gain compensates for reduced base drive)
   NO ↓

3. Is load current < 200mA AND voltage < 40V?
   → Either works. PN2222A is the safer default (global standard, lower Vce(sat))
```

**Why this is a trade-off, not a free lunch:** The S8050's higher gain comes from semiconductor physics -- a thinner base region that increases gain but reduces voltage breakdown. You cannot get 400 hFE AND 40V Vceo in a TO-92 NPN without moving to a different (more expensive, harder to source) device family.

**The availability dimension:** PN2222A is a global standard available everywhere. S8050 is common in Asian component kits but less available from Western distributors. For ProtoPulse BOM recommendations, this matters -- recommending an S8050 to someone who can only buy from Adafruit or SparkFun creates a sourcing problem.

**ProtoPulse bench coach rule:** When the coach recommends a BJT for switching, it should ask: "What is the load voltage?" and "What is the MCU logic level?" These two answers determine the transistor selection. Default to PN2222A unless both conditions favor S8050 (load <25V AND GPIO is 3.3V).

---

Source: [[s8050-npn-transistor-25v-500ma-medium-power-to92]]

Relevant Notes:
- [[3v3-gpio-driving-a-bjt-base-loses-21-percent-of-supply-voltage-to-vbe-leaving-less-headroom-for-the-base-resistor]] -- the 3.3V headroom problem that favors the S8050
- [[s8050-vce-saturation-voltage-is-double-that-of-pn2222a-at-equivalent-current-making-it-dissipate-twice-the-switching-power]] -- the thermal cost of picking S8050

Topics:
- [[passives]]
- [[eda-fundamentals]]
