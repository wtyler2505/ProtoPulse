---
description: "At 5V, a 330 ohm resistor gives 6-10mA depending on LED color Vf -- dimmer than optimal 20mA but safely within every maker MCU's GPIO current budget (Pico 12mA, Uno 20mA, ESP32 40mA)"
type: knowledge-note
source: "docs/parts/5mm-led-assortment-through-hole-red-green-blue-yellow-white-rgb.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# 330 ohm resistor is the safe universal default for any LED color at 5V

When the LED color is unknown, unspecified, or the user does not want to calculate per-color resistor values, 330 ohm at 5V is the safe default:

| Color | Vf (typ) | Current at 330 ohm | Safe? |
|-------|----------|-------------------|-------|
| Red | 2.0V | 9.1 mA | Yes (well under 12mA Pico limit) |
| Yellow | 2.0V | 9.1 mA | Yes |
| Green | 2.2V | 8.5 mA | Yes |
| Blue | 3.2V | 5.5 mA | Yes (dimmer but visible) |
| White | 3.2V | 5.5 mA | Yes (dimmer but visible) |

Every value is below the strictest GPIO current budget (Pico's 12mA per pin), and every LED receives enough current to be visibly lit. The trade-off is brightness: red/yellow at 9mA are roughly half the brightness of their 20mA maximum, and blue/white at 5.5mA are noticeably dim but functional.

This is the bench coach "just make it work" recommendation. It eliminates the need to know the LED color before selecting a resistor, and it cannot damage any standard maker MCU's GPIO pin regardless of the board used.

At 3.3V, 330 ohm is too conservative for red/yellow (only ~3.6mA) and mathematically impossible for blue/white (negative headroom). A 100 ohm resistor serves as the 3.3V equivalent for red/yellow/green, but blue/white require a 5V supply or alternative approach.

---

Relevant Notes:
- [[led-forward-voltage-varies-by-color-creating-a-graduated-resistor-selection-problem]] -- The per-color calculation that 330 ohm bypasses
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] -- 330 ohm stays safely under Pico's strictest limit
- [[breadboard-intelligence]] -- Bench coach rule-of-thumb for beginners

Topics:
- [[passives]]
- [[eda-fundamentals]]
