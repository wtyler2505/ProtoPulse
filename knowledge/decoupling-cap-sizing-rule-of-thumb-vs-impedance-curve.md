---
_schema:
  entity_type: knowledge-note
  applies_to: knowledge/*.md
description: 'Decoupling cap sizing has two tiers: the rule-of-thumb (100 nF ceramic per IC VCC pin...'
type: reference
confidence: proven
topics:
- moc-electronics-math
- eda-fundamentals
- passives
---
# decoupling cap sizing rule of thumb vs impedance curve

**[beginner]** Decoupling capacitors (also called bypass caps) sit between an IC's VCC pin and ground, as close to the pin as possible. Their job is to supply the fast transient currents the IC draws when it switches internally, so those currents do not have to travel back up the power trace and cause voltage dips. The universal rule of thumb: **100 nF (0.1 μF) ceramic per VCC pin** on every IC, plus one **10 μF bulk cap** per power rail somewhere near where the rail enters the board. That is the first-pass answer 99% of hobby and most commercial digital designs use, and it is what the Calculators tab suggests by default. Calculator card example: an ATmega328P has one VCC pin and one AVCC pin, so 2 × 100 nF plus 1 × 10 μF on the 5 V rail — three capacitors total.

**[intermediate]** The 100 nF rule-of-thumb exists because ceramic caps in the 100 nF / 0603 range happen to have a self-resonant frequency in the tens of MHz — the sweet spot for typical digital switching noise. Below resonance, a capacitor behaves as a capacitor (impedance drops with frequency). Above resonance, its parasitic series inductance (**ESL**, typically 0.5–2 nH for 0603 ceramics) dominates, and the impedance *rises* with frequency — the cap stops being a cap. 100 nF in 0603 self-resonates around 15–20 MHz, which covers the fundamental switching rates of most 8–32 bit MCUs and their first few harmonics.

The **bulk cap** (10 μF or larger, usually electrolytic or MLCC) covers the low-frequency end that 100 nF cannot reach. 100 nF has impedance of 1/(2π · 1kHz · 100nF) = 1590 Ω at 1 kHz — basically open. 10 μF at 1 kHz is 15.9 Ω — low enough to cover slow transients like an LCD backlight turning on. Below that, the voltage regulator's own impedance takes over.

The **multi-value strategy** you see on high-speed boards — 100 nF + 1 nF + 100 pF all in parallel on one VCC pin — extends the low-impedance window to higher frequencies. 1 nF self-resonates around 150 MHz; 100 pF around 500 MHz. Parallelling three caps of decade-spaced values gives low impedance from tens of kHz to hundreds of MHz. Whether this matters depends on the IC: a 16 MHz ATmega gets nothing from the extra caps (its switching is all sub-20 MHz); a 600 MHz Zynq FPGA benefits significantly.

Every digital IC in [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] uses this rule. [[missing-decoupling-capacitors-produce-three-distinct-failure-modes]] is the companion catalog of what goes wrong without them.

**[expert]** The impedance-curve (Power Integrity, PI) method replaces the rule-of-thumb when transient current is large or noise budget is tight. The procedure:

1. **Compute Z_target**. Pick the worst-case transient current I_transient the IC draws (from datasheet — often 5–10× the quiescent current for a fraction of a clock cycle) and the allowed rail ripple V_ripple (typically 2–5% of nominal VCC). Then **Z_target = V_ripple / I_transient**. Example: a 1.2 V core rail with 50 mV ripple budget and 5 A transient gives Z_target = 10 mΩ — a hard target.

2. **Plot the PDN impedance vs frequency**. Stack the impedance contributions from (a) the VRM's closed-loop output impedance up to its bandwidth (tens of kHz), (b) the bulk caps in the 1 kHz–1 MHz range, (c) the decoupling caps in the 1 MHz–1 GHz range, (d) the package/die capacitance above 1 GHz. Sum them in parallel as complex impedances — at each frequency, the total is 1/(Σ 1/Z_i) with Z_i being complex.

3. **Pick caps such that the sum stays below Z_target across the frequency band where the IC has significant switching content**. The valleys of each cap's resonance stack additively when they are close together; putting 10 caps of the same value in parallel drops the impedance floor by 10× but also creates anti-resonant peaks between them and the bulk cap. Real-world designs use 3–4 decade-spaced cap values with multiple copies of each.

4. **Verify with simulation or measurement** (VNA on a prototype board). The layout matters enormously: a "100 nF cap" connected with 10 mm of trace has an additional ~10 nH of loop inductance that raises the impedance by a factor of 100 at 100 MHz. Via count, via location, and plane proximity dominate real-world performance above ~10 MHz.

Three specific traps:

First, **ceramic capacitor DC bias effect**. X7R and especially Y5V ceramics lose 20–80% of their rated capacitance at their rated DC voltage. A 10 μF / 6.3 V / X7R cap at 5 V bias may be 3 μF effective. Impedance-curve designs compute with *effective* C, not nameplate C. NP0/C0G is bias-stable but limited to small values (typically < 100 nF for reasonable size). Tantalum and polymer caps are bias-stable but have different failure modes and ESR characteristics.

Second, **anti-resonance between bulk and decoupling caps**. A 10 μF cap and a 100 nF cap in parallel have a parallel LC resonance around 1–10 MHz where their impedances can add instead of subtract — a peak in the PDN impedance, not a valley. The fix is intermediate values (1 μF) to fill the gap, or careful selection of ESR values so the peak is damped.

Third, **ground/power plane inductance** is often the real limiter above 100 MHz, not the caps. A 4-layer board with a dedicated ground plane and a power plane separated by thin prepreg acts as a distributed capacitor — effectively a high-Q cap with very low loop inductance. This "plane capacitance" provides the 100 MHz – 1 GHz impedance floor that discrete caps cannot reach regardless of how many are placed. Impedance-curve design for high-speed digital is more about plane design than about cap selection.

[[analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements]] is the analog-specific corollary: the math is the same, but Z_target comes from the analog noise floor rather than a digital ripple budget, and the numbers are often a decade tighter.

---

Relevant Notes:
- [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] — the rule-of-thumb application of this math
- [[missing-decoupling-capacitors-produce-three-distinct-failure-modes]] — what goes wrong without them
- [[multi-vcc-ics-need-one-decoupling-capacitor-per-vcc-pin-not-one-per-package]] — per-pin placement rule
- [[analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements]] — analog-specific sizing
- [[dielectric-tolerance-is-irrelevant-for-decoupling-because-the-exact-capacitance-value-does-not-matter-for-transient-suppression]] — tolerance-insensitive usage pattern
- [[rc-lowpass-cutoff-frequency-1-over-2-pi-rc]] — decoupling is the same RC filter math with R = supply source impedance
- [[max7219-requires-both-ceramic-and-electrolytic-decoupling-caps-or-spi-communication-becomes-unreliable]] — mixed-value decoupling worked case

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
- [[passives]]
