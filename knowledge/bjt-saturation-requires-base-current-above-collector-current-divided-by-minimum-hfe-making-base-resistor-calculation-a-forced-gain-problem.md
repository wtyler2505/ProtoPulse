---
description: "To fully saturate a BJT switch, the base current must exceed Ic/hFE_min -- a 1K resistor from 5V GPIO gives ~4.3mA base current, which with hFE_min=100 saturates for loads up to 430mA; this forced-gain math is the fundamental design step for any BJT switching circuit"
type: knowledge-note
source: "docs/parts/pn2222a-npn-transistor-40v-600ma-general-purpose-to92.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# BJT saturation requires base current above collector current divided by minimum hFE making base resistor calculation a forced gain problem

A BJT used as a switch must be driven into saturation -- the region where Vce drops to a minimum (~0.3V for PN2222A) and the transistor acts as a near-short from collector to emitter. To reach saturation, the base current must satisfy:

```
Ib > Ic / hFE_min
```

Where:
- Ib = base current (determined by base resistor and GPIO voltage)
- Ic = collector current (determined by the load)
- hFE_min = minimum DC current gain from the datasheet (not typical, not maximum)

**The base resistor determines Ib:**

```
Ib = (V_gpio - Vbe) / R_base
```

For a 5V GPIO: `Ib = (5.0 - 0.7) / R_base = 4.3V / R_base`

**Graduated base resistor selection for PN2222A (hFE_min = 100):**

| Load Current (Ic) | Required Ib_min | Base Resistor | Actual Ib | Overdrive Ratio |
|-------------------|----------------|---------------|-----------|-----------------|
| <100mA | <1mA | 4.7K | 0.9mA | ~1x (marginal) |
| 100-300mA | 1-3mA | 1K-2.2K | 2-4.3mA | ~1.5-2x (good) |
| 300-600mA | 3-6mA | 470R-1K | 4.3-9.1mA | ~1.5x |

**Graduated base resistor selection for S8050 (hFE_min = 40):**

| Load Current (Ic) | Required Ib_min | Base Resistor (5V) | Base Resistor (3.3V) | Notes |
|-------------------|----------------|-------------------|---------------------|-------|
| <50mA | <1.25mA | 2.2K-3.3K | 1K-2.2K | Both comfortable |
| 50-200mA | 1.25-5mA | 470R-1K | 330R-680R | 3.3V needs lower R |
| 200-500mA | 5-12.5mA | 220R-470R | Not practical | GPIO current too high at 3.3V |

**Key difference from PN2222A:** The S8050's hFE_min of 40 (versus 100) means the minimum required base current is 2.5x higher for the same load current. At 500mA load, Ib_min = 12.5mA, which at 3.3V would require R_base = 208R and pull nearly 13mA from the GPIO -- exceeding many 3.3V MCU pin limits. The S8050's advantage (high typical hFE for easy saturation) only helps if the actual hFE is well above the minimum.

**Why overdrive matters:** Using hFE_min alone puts the transistor right at the saturation boundary. Temperature, component variation, and aging can push it out of saturation, increasing Vce and power dissipation. A 2-5x overdrive factor (Ib = 2-5x the minimum required) ensures robust saturation across all conditions.

**The design procedure for any BJT switch:**
1. Determine load current Ic
2. Look up hFE_min from datasheet (ignore typical/max values)
3. Calculate required Ib = Ic / hFE_min
4. Apply overdrive factor (2-5x)
5. Calculate R_base = (V_gpio - 0.7) / (Ib x overdrive)
6. Verify power dissipation: P_total = Ic x Vce(sat) + Ib x Vbe

**ProtoPulse bench coach implication:** When a BJT appears in a schematic, verify the base resistor value against this formula. A missing base resistor means direct GPIO drive (~20-40mA from Arduino, ~12mA from ESP32) which may or may not saturate the transistor depending on load current, and will definitely over-stress the GPIO pin.

---

Source: [[pn2222a-npn-transistor-40v-600ma-general-purpose-to92]]

Relevant Notes:
- [[330-ohm-resistor-is-the-safe-universal-default-for-any-led-color-at-5v]] -- analogous "default resistor" reasoning for LED current limiting
- [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] -- the MOSFET alternative where gate drive is voltage-based, not current-based

Topics:
- [[passives]]
- [[eda-fundamentals]]
