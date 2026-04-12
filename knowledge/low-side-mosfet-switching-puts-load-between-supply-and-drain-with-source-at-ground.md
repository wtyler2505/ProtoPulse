---
description: "Low-side N-channel MOSFET switching grounds the load through the MOSFET (source at GND) -- simpler than high-side because gate voltage is referenced to ground, matching the MCU's output"
type: concept
source: "docs/parts/p30n06le-n-channel-logic-level-mosfet-60v-30a.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[passives]]"
  - "[[eda-fundamentals]]"
related_components:
  - "p30n06le"
---

# Low-side MOSFET switching puts load between supply and drain with source at ground

There are two ways to place a MOSFET in a DC load circuit: high-side (between V+ and load) or low-side (between load and GND). For N-channel MOSFETs driven from an MCU, low-side switching is overwhelmingly preferred because the source pin sits at ground, which means the gate voltage is referenced to the same ground as the MCU's GPIO output.

**Low-side topology:**
```
V+ ──→ Load (+) ──→ Load (-) ──→ MOSFET Drain
                                  MOSFET Source ──→ GND
                                  MOSFET Gate ←── GPIO pin
                                  10K resistor Gate → Source
```

When GPIO goes HIGH (5V above GND), Vgs = 5V, MOSFET saturates, load is powered. When GPIO goes LOW (0V), Vgs = 0V, MOSFET is off, load is disconnected from ground.

**Why not high-side with N-channel?** In a high-side configuration, the source would connect to the load (not to GND). When the MOSFET turns on, the source voltage rises to nearly V+ (e.g., 36V). Now Vgs = 5V (GPIO) - 36V (source) = -31V -- the MOSFET turns OFF harder. You'd need a gate driver that produces voltage above V+ (a charge pump or bootstrap circuit) to keep the MOSFET on. That's the entire reason high-side gate driver ICs exist.

**Low-side switching trade-off:** The load's "ground" connection floats when the MOSFET is off. For simple resistive loads (LEDs, heaters) this doesn't matter. For loads with their own logic (smart devices, controllers with ground-referenced communication), the floating ground can cause communication errors. In those cases, use a P-channel MOSFET for high-side switching or a dedicated high-side driver IC.

**PWM capability:** Low-side switching with `analogWrite()` gives proportional power control -- LED dimming, motor speed control, heater regulation. The P30N06LE's low Rds_on means minimal switching losses at typical Arduino PWM frequencies (490Hz or 980Hz).

---

Relevant Notes:
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] -- the gate voltage that makes low-side direct drive possible
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] -- the pull-down resistor required in this topology
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] -- MOSFETs as an alternative to relays for DC load switching

Topics:
- [[power-systems]]
- [[passives]]
- [[eda-fundamentals]]
