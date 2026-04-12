---
description: "Kit IR LED modules like the OSEPP IRF-01 have ~1-2m practical range because GPIO pins can only source 20-40mA — extending range requires a PN2222A driver transistor to push 100mA+ through a higher-current IR LED"
type: claim
source: "docs/parts/osepp-ir-transmitter-irf01-38khz-led-module.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "osepp-irf-01"
  - "pn2222a-transistor"
---

# Bare IR LED breakout modules have 1-2m range and extending range requires a driver transistor

The OSEPP IRF-01 and similar kit IR LED breakout modules achieve only ~1-2 meters of practical range. This is because the IR LED is driven directly from a GPIO pin, which limits current to 20-40mA (the absolute max for most MCU pins). The radiant intensity of an IR LED scales roughly linearly with drive current in the useful range.

**Why this matters for projects:**
- A desk-range demo works fine at 1-2m
- A room-control project (IR controlling a TV, AC unit, or robot across a room) needs 5-10m range
- An outdoor project is unrealistic with bare LED modules

**The fix — transistor driver circuit:**
1. Use a PN2222A NPN transistor (already in many kit inventories, rated 600mA continuous)
2. MCU GPIO pin drives the transistor base through a 1k resistor
3. Transistor collector drives the IR LED through a current-limiting resistor
4. LED current can now be 100-200mA (set by resistor value), dramatically increasing range
5. At 100mA with a TSAL6200-type IR LED, range extends to 5-10m depending on ambient light

**ProtoPulse implications:**
- The bench coach should ask about required range when an IR transmitter appears in a project
- If range > 2m is specified, the coach should recommend the transistor driver circuit and add the PN2222A + resistors to the BOM
- The schematic generator should have an "IR transmitter with driver" template that includes the transistor circuit
- DRC should warn if an IR LED is connected directly to a GPIO pin in a project that specifies room-scale range requirements

---

Relevant Notes:
- [[nec-ir-button-codes-are-manufacturer-specific-making-code-first-debugging-impossible-without-reading-your-own-remote]] — transmitter-side debugging (complementary)
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] — range limitation should be flagged before deployment, not discovered after

Topics:
- [[communication]]
- [[breadboard-intelligence]]
