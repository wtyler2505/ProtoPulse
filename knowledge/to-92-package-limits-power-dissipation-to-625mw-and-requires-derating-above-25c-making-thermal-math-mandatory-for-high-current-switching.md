---
description: "The TO-92 plastic package (used by PN2222A, S8050, 2N3904, and many small-signal transistors) dissipates a maximum of 625mW in free air at 25C -- above 25C the limit drops linearly, requiring power dissipation verification for any load above ~200mA"
type: knowledge-note
source: "docs/parts/pn2222a-npn-transistor-40v-600ma-general-purpose-to92.md"
topics:
  - "[[passives]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# TO-92 package limits power dissipation to 625mW and requires derating above 25C making thermal math mandatory for high-current switching

The TO-92 package is the smallest common through-hole transistor package. Its tiny plastic body has limited thermal conductivity, which constrains how much power the transistor die can dissipate without overheating.

**The fundamental limit:** 625mW at 25C ambient, with a typical derating factor of 5mW/C above 25C.

| Ambient Temperature | Max Power Dissipation |
|--------------------|-----------------------|
| 25C | 625 mW |
| 50C | 500 mW |
| 75C | 375 mW |
| 100C | 250 mW |

**Power dissipation in a saturated BJT switch:**

```
P_total = (Ic x Vce_sat) + (Ib x Vbe)
```

For a PN2222A at 300mA with Vce(sat) = 0.3V and Ib = 3mA:
```
P = (0.3A x 0.3V) + (0.003A x 0.7V) = 90mW + 2.1mW = 92mW (well within limit)
```

**When the limit bites:** The problem is not full saturation -- it is partial saturation or linear-region operation. If the base drive is insufficient and Vce rises to 2V instead of 0.3V:
```
P = 0.3A x 2V = 600mW (at the limit!)
```

This is why base resistor calculation matters for thermal reasons, not just switching speed. An under-driven BJT dissipates dramatically more power because Vce increases.

**Practical guidance for ProtoPulse:**
- Loads under 200mA in TO-92: thermal is almost never an issue (200mA x 0.3V = 60mW)
- Loads 200-600mA in TO-92: verify saturation and calculate power dissipation
- Loads above 600mA: transition to a MOSFET or TO-220 package transistor

---

Source: [[pn2222a-npn-transistor-40v-600ma-general-purpose-to92]]

Relevant Notes:
- [[bjt-saturation-requires-base-current-above-collector-current-divided-by-minimum-hfe-making-base-resistor-calculation-a-forced-gain-problem]] -- insufficient base drive causes partial saturation, increasing power dissipation
- [[clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback]] -- analogous thermal limit problem in voltage regulators

Topics:
- [[passives]]
- [[power-systems]]
