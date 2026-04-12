---
description: "Running two buck converters in parallel from the battery (36V->12V and 36V->5V) isolates failure domains and noise -- cascading (36V->12V->5V) creates a single point of failure and couples motor noise into the logic rail"
type: decision
source: "docs/parts/lm2596-adjustable-buck-converter-module-3a-step-down.md"
confidence: proven
topics:
  - "[[power-systems]]"
related_components:
  - "lm2596"
  - "hoverboard-10s-battery-pack"
---

# Parallel power rails from battery are more reliable than cascaded regulators

When a rover needs both 12V (fans, relays, accessories) and 5V (MCU, sensors, level shifters) from a 36V battery pack, there are two topologies:

**Cascade: 36V -> 12V -> 5V**
- The 12V regulator feeds the 5V regulator's input
- If the 12V regulator fails or overloads, the 5V rail dies too
- Motor-adjacent noise on the 12V rail (relay switching, fan inrush) propagates into the 5V rail's input
- The 5V regulator's input range is constrained to whatever the 12V rail actually produces under load

**Parallel: 36V -> 12V AND 36V -> 5V (separate regulators)**
- Each rail has its own regulator connected directly to the battery
- A failure on the 12V rail doesn't affect the 5V rail
- Noise from 12V loads (relays, fans) stays on the 12V rail
- Each regulator handles its own voltage differential independently

**Why parallel wins for rover-class projects:**
1. **Isolation:** The MCU on the 5V rail keeps running even if the 12V rail has problems (fan stall, relay coil short)
2. **Noise:** Relay contacts and fan motors generate high-frequency switching noise. In a cascade, this noise appears at the 5V regulator's input, potentially degrading its output quality
3. **Simplicity:** Both regulators see the same input voltage (30-42V), so thermal behavior is predictable
4. **Redundancy:** You can add a third parallel regulator (3.3V) for ESP32/sensor rails without cascading further

**The cost:** Parallel topology means each regulator must handle the full 36V input-to-output differential. The 36V->5V regulator drops 31V, which is less efficient than a hypothetical 12V->5V drop of 7V. But the LM2596's switching efficiency (~83% at 36V->5V) makes this acceptable -- the ~1W extra loss is worth the isolation benefits.

---

Relevant Notes:
- [[switching-buck-converters-waste-watts-not-volts-making-them-essential-for-large-voltage-differentials]] -- why the 31V drop is manageable with switching regulators
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- the multi-rail architecture this decision implements

Topics:
- [[power-systems]]
