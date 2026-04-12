---
description: "22pF and other small-value ceramic caps are physically tiny, often unmarked or marked only with a number like '22', and visually indistinguishable from 100nF or other small ceramics -- grabbing the wrong cap is a silent failure that shifts oscillator frequency or degrades decoupling"
type: knowledge-note
source: "docs/parts/22pf-ceramic-capacitor-npo-50v-crystal-load-cap.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Unmarked small ceramic capacitors are a practical inventory hazard requiring physical separation or labeling

Small ceramic capacitors (through-hole disc or MLCC) in the picofarad to nanofarad range share several properties that make them easy to confuse:

1. **Physical size** -- 22pF, 100pF, 1nF, 10nF, and 100nF disc ceramics can be nearly identical in size and shape
2. **Marking** -- Many are unmarked entirely, or use a numeric code ("22" for 22pF, "104" for 100nF) that requires knowing the code system to interpret
3. **Color** -- No universal color coding exists for ceramic caps (unlike resistors); different manufacturers use different body colors for the same value
4. **No polarity markings** -- Non-polarized, so there is no additional visual cue from orientation marks

When markings ARE present, they use the three-digit code system (see [[three-digit-ceramic-capacitor-codes-encode-picofarads-as-two-significant-digits-times-a-power-of-ten-multiplier]]):

| Marking | Value | Common Role |
|---------|-------|-------------|
| 220 | 22pF | Crystal load |
| 104 | 100nF | Decoupling |
| 103 | 10nF | Filtering |
| 105 | 1uF | Bulk bypass |

But many disc ceramics have NO marking at all, or only a manufacturer logo.

**The failure mode:** Swapping a 22pF crystal load cap with a 100nF decoupling cap (or vice versa) produces no immediate visible error. The crystal will likely still oscillate (just at the wrong frequency), and the decoupled IC will likely still function (just with worse noise performance). These are silent, intermittent failures that manifest as communication errors, timing drift, or analog noise -- not as "it doesn't work at all."

**Mitigation for parts inventory:**
- Store small-value ceramics in individually labeled bags or compartments
- Verify with a capacitance meter before installation in timing-critical circuits
- Keep crystal load caps (NPO/C0G, picofarad range) physically separated from decoupling caps (X7R, nanofarad-microfarad range)

**ProtoPulse implication:** The parts inventory system should flag capacitor values that are commonly confused and include verification guidance in the bench coach workflow.

---

Relevant Notes:
- [[crystal-load-capacitance-equals-the-series-combination-of-two-matched-caps-plus-stray-capacitance]] -- Wrong cap value silently shifts oscillator frequency
- [[npo-c0g-dielectric-is-mandatory-for-crystal-load-capacitors-because-temperature-driven-capacitance-drift-shifts-oscillator-frequency]] -- Even the right value in wrong dielectric causes problems

Topics:
- [[passives]]
- [[eda-fundamentals]]
