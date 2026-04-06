---
description: Bench coach logic, verified breadboard layouts, layout quality rules, and hardware debugging patterns
type: moc
topics:
  - "[[index]]"
  - "[[eda-fundamentals]]"
  - "[[maker-ux]]"
---

# breadboard-intelligence

Knowledge about breadboard layout, hardware debugging, and the "bench coach" concept — the AI that watches what you're building and speaks up proactively.

## Breadboard Layout Principles

### Power Rails
- Red rail = VCC, Blue/Black rail = GND. Never cross them.
- Decouple every IC: 100nF ceramic cap as close to VCC pin as possible.
- Separate analog and digital ground returns when possible.

### Component Placement
- ICs straddle the center channel — legs span both sides.
- Keep signal paths short. Long wires = antennas.
- Pull-ups and pull-downs as close to the input pin as possible.
- Crystals and resonators: minimize trace/wire length, keep away from power.

### Common Mistakes (high teaching value)
- Forgetting decoupling capacitors → unexplained resets and logic errors
- Floating inputs (unconnected GPIO) → random behavior
- Shared ground return paths → ground bounce, false readings
- I2C without pull-ups → bus never goes high, SDA/SCL stuck low
- Bypassing the voltage regulator → sensitive ICs damaged by 5V on 3.3V rail

## Verified Board Profiles
ProtoPulse maintains profiles for common boards in `server/ai-tools/arduino.ts`:
- Arduino Uno (ATmega328P, 5V, 16MHz)
- Arduino Mega 2560 (5V, 16MHz, 54 digital pins)
- NodeMCU ESP8266 (3.3V, 80/160MHz, WiFi)
- ESP32 DevKit (3.3V, 240MHz, WiFi+BT, dual-core)
- Raspberry Pi Pico (RP2040, 3.3V, 133MHz, dual-core)
- STM32 Blue Pill (STM32F103, 3.3V, 72MHz)

## Layout Quality Heuristics
These are the rules the DRC and AI coach use to evaluate breadboard designs:
- No dangling wires (wire must connect to a hole or terminal on both ends)
- No floating IC inputs (pull-up or pull-down required)
- Power rail continuity check (VCC rail must reach all VCC connections)
- Short-circuit detection (VCC directly connected to GND)
- Component count vs. available rows check

## Bench Coach Concept
The bench coach is a proactive AI that:
1. Detects what you're building from the schematic context
2. Surfaces relevant warnings before you make a mistake
3. Asks clarifying questions ("Are you powering this from USB or external supply?")
4. Links to relevant datasheets and pinout diagrams
5. Suggests next steps ("You'll want a flyback diode across that motor driver")

Implementation home: `server/ai-tools/architecture.ts`, `server/ai-tools/circuit.ts`

---

Topics:
- [[index]]
- [[eda-fundamentals]]
- [[maker-ux]]
