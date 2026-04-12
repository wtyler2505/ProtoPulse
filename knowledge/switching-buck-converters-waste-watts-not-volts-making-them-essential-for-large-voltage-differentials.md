---
description: "A linear regulator stepping 36V to 5V at 1A wastes 31W as heat; a switching buck converter (LM2596) wastes only 3-4W for the same job -- the efficiency gap makes switching mandatory above ~10V differential"
type: insight
source: "docs/parts/lm2596-adjustable-buck-converter-module-3a-step-down.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "lm2596"
  - "kia7809a"
---

# Switching buck converters waste watts not volts making them essential for large voltage differentials

A linear voltage regulator (LM7805, KIA7809A) works by acting as a variable resistor -- it drops the excess voltage across itself, converting the difference to heat. A switching buck converter (LM2596) chops the input voltage at high frequency and uses an inductor to average it down to the desired output. The practical difference is dramatic at large voltage differentials:

**The math at 36V input, 5V output, 1A load:**
- Linear: P_waste = (Vin - Vout) x Iout = (36 - 5) x 1 = **31W as heat**. This is a small space heater. No heatsink can reasonably dissipate this in a confined rover chassis.
- Switching (85% efficient): P_waste = Pout / efficiency - Pout = (5/0.85) - 5 = **0.88W as heat**. Barely warm to the touch.

**The crossover point:** Linear regulators are simpler, cheaper, have zero output ripple, and need no inductor. They make sense when the voltage differential is small (7V -> 5V = 2W at 1A) or the current is tiny (<50mA). Above ~10V differential at any significant current, switching regulators are the only practical choice.

**LM2596 efficiency varies with conditions:**

| Vin | Vout | Iout | Efficiency | P_waste |
|-----|------|------|-----------|---------|
| 36V | 12V | 0.5A | ~92% | 0.5W |
| 36V | 12V | 2.0A | ~87% | 3.6W |
| 36V | 5V | 0.3A | ~88% | 0.2W |
| 36V | 5V | 1.0A | ~83% | 1.0W |
| 36V | 5V | 2.0A | ~78% | 2.8W |

**The tradeoff:** Switching regulators introduce output ripple (~30mV for LM2596, worse under heavy load). Sensitive analog circuits (ADC reference voltages, audio amplifiers) may need a secondary LC filter or a post-regulator LDO to clean up the ripple. For digital logic (Arduino, ESP32, sensors), 30mV ripple is irrelevant.

**ProtoPulse implications:** The power analysis tools should recommend switching regulators when the voltage differential exceeds 5V at currents above 100mA. When a linear regulator is placed in a high-differential circuit, the thermal analysis should flag the wasted power and suggest a switching alternative.

---

Relevant Notes:
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- each tier needs the right regulation strategy
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] -- the 30-42V input range that the buck converter must handle

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
