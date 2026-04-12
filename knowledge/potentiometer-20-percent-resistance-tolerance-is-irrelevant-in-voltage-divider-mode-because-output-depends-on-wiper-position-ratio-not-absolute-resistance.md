---
description: "A 10K pot with +/-20% tolerance might actually be 8K or 12K -- but as a voltage divider (VCC-wiper-GND), the output voltage depends on the wiper's fractional position along the element, not the absolute resistance, so tolerance cancels out completely"
type: knowledge-note
source: "docs/parts/potentiometer-10k-rotary-b10k-linear-taper.md"
topics:
  - "[[passives]]"
confidence: high
verified: false
---

# Potentiometer 20 percent resistance tolerance is irrelevant in voltage divider mode because output depends on wiper position ratio not absolute resistance

Standard potentiometers are specified at +/-20% tolerance -- meaning a "10K" pot could be anywhere from 8K to 12K. This sounds imprecise compared to 1% or 5% resistors. But in the primary use case (voltage divider for analogRead), tolerance is irrelevant.

**The math:**

For a pot wired as VCC-wiper-GND, the output voltage at any wiper position is:

```
V_out = VCC x (R_lower / R_total)
```

Where R_lower is the resistance between the wiper and GND, and R_total is the total pot resistance.

If the wiper is at 50% position:
- On a perfect 10K pot: R_lower = 5K, R_total = 10K → V_out = VCC x 5K/10K = 0.5 VCC
- On a "10K" pot that measures 12K: R_lower = 6K, R_total = 12K → V_out = VCC x 6K/12K = 0.5 VCC
- On a "10K" pot that measures 8K: R_lower = 4K, R_total = 8K → V_out = VCC x 4K/8K = 0.5 VCC

The ratio is always the same because both halves of the divider scale together. The absolute resistance drops out of the equation entirely.

**When tolerance DOES matter:**
1. **Current draw:** A 8K pot draws 5V/8K = 0.625mA; a 12K pot draws 5V/12K = 0.417mA. The difference is usually negligible for power budget but matters for ultra-low-power designs.
2. **Source impedance for ADC:** The ADC sees the parallel combination of the two pot halves as source impedance. A 12K pot at midpoint = 3K source impedance; an 8K pot = 2K. For ATmega328P (recommended <10K source impedance), both are fine. For ADCs with stricter requirements, the variation could matter.
3. **Variable resistor mode:** If the pot is used as a two-terminal variable resistor (e.g., in an RC timing circuit), the absolute value matters and tolerance directly affects the circuit behavior.

**ProtoPulse note:** This is analogous to [[dielectric-tolerance-is-irrelevant-for-decoupling-because-the-exact-capacitance-value-does-not-matter-for-transient-suppression]] -- a case where a specification that looks important is actually irrelevant for the primary use case.

---

Source: [[potentiometer-10k-rotary-b10k-linear-taper]]

Relevant Notes:
- [[dielectric-tolerance-is-irrelevant-for-decoupling-because-the-exact-capacitance-value-does-not-matter-for-transient-suppression]] -- analogous "tolerance doesn't matter" insight for capacitors
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]] -- the voltage divider circuit where this tolerance cancellation applies

Topics:
- [[passives]]
