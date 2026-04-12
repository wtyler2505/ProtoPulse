---
description: "A 78xx linear regulator converts (Vin - Vout) x Iload entirely to heat -- at 36V input, 9V output, 1A load this is 27W, which will thermally destroy the regulator without an impractically large heatsink"
type: claim
source: "docs/parts/kia7809a-9v-linear-voltage-regulator-1a.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "kia7809a"
  - "lm2596"
---

# Linear regulator heat dissipation equals voltage drop times current making high-differential applications dangerous

The 78xx-series linear regulator family (7805, 7809, 7812) works by acting as a variable resistor. The regulator's pass transistor conducts the load current while dropping the excess voltage across itself. The power dissipated is exactly:

**P_dissipated = (Vin - Vout) x I_load**

This is not an approximation -- it's physics. Every watt of that power becomes heat in the regulator's TO-220 package.

**Practical examples with the KIA7809A (9V output):**

| Vin | Vout | I_load | P_waste | Heatsink needed? |
|-----|------|--------|---------|------------------|
| 12V | 9V | 0.5A | 1.5W | Small heatsink or copper pour |
| 12V | 9V | 1.0A | 3.0W | Medium heatsink required |
| 24V | 9V | 0.5A | 7.5W | Large heatsink with airflow |
| 36V | 9V | 0.5A | 13.5W | Impractical -- use switching regulator |
| 36V | 9V | 1.0A | 27W | Impossible without active cooling |

**The TO-220 package has a thermal resistance of ~5C/W to heatsink.** At 27W, that's 135C rise above the heatsink temperature -- well above the 150C junction temperature limit. The regulator's thermal shutdown will trigger repeatedly, making the output unreliable.

**The staged regulation pattern:** When a linear regulator is needed for its zero-ripple output but the input voltage is too high, pre-regulate with a switching converter:
- 36V battery -> LM2596 set to 12V -> KIA7809A to 9V
- The linear regulator only drops 3V, dissipating (3V x 0.5A) = 1.5W -- easily managed without a large heatsink
- The switching converter's ~30mV ripple is cleaned up by the linear regulator's output

**Why not just use the switching converter?** A linear regulator produces zero output ripple and zero switching noise. For powering sensitive analog circuits (ADC references, audio paths), the clean output justifies the two-stage approach.

**The dropout voltage constraint:** The KIA7809A requires at least 2.5V above its output (11.5V minimum input) for proper regulation. Below this, the output droops and becomes unregulated. This sets the minimum output of any upstream switching converter.

---

Relevant Notes:
- [[switching-buck-converters-waste-watts-not-volts-making-them-essential-for-large-voltage-differentials]] -- the complementary technology that handles what linear regulators cannot
- [[parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators]] -- when to cascade vs parallel (staged regulation is the one case where cascade makes sense)
- [[78l05-regulator-failure-kills-hall-power-making-motor-appear-dead-when-only-the-regulator-failed]] -- thermal failure in a 78xx regulator causing downstream system failure

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
