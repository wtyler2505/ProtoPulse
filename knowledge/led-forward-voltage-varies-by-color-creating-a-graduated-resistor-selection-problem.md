---
description: "Red/yellow ~1.8-2.2V, green ~2.0-2.4V, blue/white ~3.0-3.4V forward voltage means the current-limiting resistor for the same supply voltage changes significantly across LED colors -- a resistor for red will overdrive blue by ~30% if swapped"
type: knowledge-note
source: "docs/parts/5mm-led-assortment-through-hole-red-green-blue-yellow-white-rgb.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# LED forward voltage varies by color creating a graduated resistor selection problem

Standard 5mm through-hole LEDs have forward voltages that vary by nearly 2x across the color spectrum:

| Color | Forward Voltage (Vf) | Resistor at 5V / 20mA | Resistor at 3.3V / 20mA |
|-------|---------------------|----------------------|------------------------|
| Red | 1.8-2.2V | 150-180 ohm | 56-75 ohm |
| Yellow | 1.8-2.2V | 150-180 ohm | 56-75 ohm |
| Green | 2.0-2.4V | 130-150 ohm | 47-68 ohm |
| Blue | 3.0-3.4V | 68-100 ohm | Marginal (0-15 ohm) |
| White | 3.0-3.4V | 68-100 ohm | Marginal (0-15 ohm) |

The formula `R = (Vsupply - Vf) / If` is the same for every LED, but the Vf term swings enough to produce a 2:1 ratio in resistor values between red and blue at 5V. A 150 ohm resistor sized for a red LED at 5V would push ~12mA through a blue LED (vs. the intended 20mA) -- but a 68 ohm resistor sized for blue would push ~44mA through a red LED, exceeding the 20mA rating by more than 2x.

**DRC implication:** When an LED color is specified in a schematic, the resistor value must be calculated from that color's specific Vf, not a generic "LED resistor" value. A color-unaware resistor pick is a DRC violation.

---

Relevant Notes:
- [[most-maker-displays-accept-3v3-5v-but-character-lcds-and-7-segments-are-5v-only-gotchas]] -- Same resistor formula applied to 7-segment displays with 2.1V Vf
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] -- Per-pin current budget interacts with per-color Vf selection
- [[330-ohm-resistor-is-the-safe-universal-default-for-any-led-color-at-5v]] -- Universal safe value when color-specific calculation is not desired

Topics:
- [[passives]]
- [[eda-fundamentals]]
