---
description: "A 100nF decoupling cap at +/-20% tolerance (80-120nF actual) works identically to one at +/-5% -- the capacitor's job is to present a low-impedance path for high-frequency transients, which depends on parasitic inductance and placement, not precise capacitance"
type: knowledge-note
source: "docs/parts/100nf-ceramic-capacitor-104-50v-decoupling-bypass.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Dielectric tolerance is irrelevant for decoupling because the exact capacitance value does not matter for transient suppression

For decoupling capacitors, X7R (10-15% tolerance), Y5V (up to -80% at temperature extremes), and even Z5U are all acceptable. This is the opposite of crystal load capacitors, where dielectric stability is critical.

**Why tolerance does not matter for decoupling:**

The decoupling capacitor's function is to present a low-impedance path between VCC and GND at high frequencies (1-100MHz). This impedance is determined by:

```
Z = 1 / (2π × f × C) + ESR + (2π × f × ESL)
```

At the frequencies where decoupling matters (>1MHz), the dominant impedance terms are **ESR** (equivalent series resistance) and **ESL** (equivalent series inductance from lead length and trace routing), not the capacitance itself. Whether the cap is 80nF or 120nF changes Z by roughly 10% at 10MHz -- negligible compared to the effect of adding 5mm of lead length (which can double ESL).

**The practical implication:** When stocking 100nF decoupling caps, buy the cheapest X7R or Y5V available. The money saved on tolerance is better spent on buying more caps (to decouple every IC) or on NPO/C0G caps for the few applications where dielectric matters (crystal loading, timing, RF).

**This is NOT true for:**
- Crystal load capacitors -- capacitance drift shifts oscillator frequency (see [[npo-c0g-dielectric-is-mandatory-for-crystal-load-capacitors-because-temperature-driven-capacitance-drift-shifts-oscillator-frequency]])
- Filter capacitors in precision analog circuits -- capacitance sets the corner frequency
- Timing circuits (RC delays) -- capacitance directly determines timing

---

Relevant Notes:
- [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] -- The application where tolerance is irrelevant
- [[npo-c0g-dielectric-is-mandatory-for-crystal-load-capacitors-because-temperature-driven-capacitance-drift-shifts-oscillator-frequency]] -- The application where tolerance IS critical

Topics:
- [[passives]]
- [[eda-fundamentals]]
