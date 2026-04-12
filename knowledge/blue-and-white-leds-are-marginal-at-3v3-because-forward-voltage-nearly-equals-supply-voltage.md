---
description: "At 3.0-3.4V Vf versus 3.3V supply, blue/white LEDs have 0-0.3V headroom -- no room for a current-limiting resistor, LEDs will be dim or dark, distinct from 7-segment 3.3V issues where 2.1V Vf still leaves 1.2V"
type: knowledge-note
source: "docs/parts/5mm-led-assortment-through-hole-red-green-blue-yellow-white-rgb.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Blue and white LEDs are marginal at 3.3V because forward voltage nearly equals supply voltage

Blue and white LEDs have a forward voltage of 3.0-3.4V, which overlaps with the 3.3V supply rail used by ESP32, ESP8266, and Pi Pico. The arithmetic is brutal:

- Best case: `3.3V - 3.0V = 0.3V` headroom, allowing a 15 ohm resistor at 20mA
- Worst case: `3.3V - 3.4V = -0.1V` -- the LED simply will not turn on
- Typical: `3.3V - 3.2V = 0.1V` headroom, effectively no current-limiting possible

At these margins, you can sometimes connect with a 10-33 ohm resistor or even direct GPIO connection (relying on the pin's internal current limit as implicit protection), but this is not recommended practice. The LED will be noticeably dimmer than at 5V, and unit-to-unit Vf variation means some LEDs from the same batch will be bright while others are dark.

This is a **distinct and worse problem** than the 7-segment 3.3V gotcha: raw 7-segment LEDs have ~2.1V Vf, leaving 1.2V headroom at 3.3V -- enough for a proper resistor, just with reduced brightness. Blue/white standalone LEDs have no such headroom.

**DRC implication:** Flag blue or white LEDs connected to 3.3V MCU GPIO pins as a compatibility warning. Suggest either using a 5V supply rail with a level-shifted control signal, or substituting a red/green LED if the color is not critical.

---

Relevant Notes:
- [[most-maker-displays-accept-3v3-5v-but-character-lcds-and-7-segments-are-5v-only-gotchas]] -- Same voltage-mismatch pattern, but 7-segments have more headroom
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] -- ESP32 projects are 3.3V and directly affected
- [[led-forward-voltage-varies-by-color-creating-a-graduated-resistor-selection-problem]] -- The Vf table that makes this problem visible

Topics:
- [[passives]]
- [[eda-fundamentals]]
