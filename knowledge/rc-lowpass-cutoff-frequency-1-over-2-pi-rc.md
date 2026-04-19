---
_schema:
  entity_type: knowledge-note
  applies_to: knowledge/*.md
description: 'The RC lowpass cutoff f_c = 1/(2πRC) comes from two layered facts: the angular cutoff is ω_c = 1/τ = 1/RC rad/s...'
type: reference
confidence: proven
topics:
- moc-electronics-math
- eda-fundamentals
- passives
---
# rc lowpass cutoff frequency 1 over 2 pi rc

**[beginner]** An RC lowpass filter (one resistor in series, one capacitor from output to ground) passes slow signals and blocks fast ones. The cutoff frequency — the boundary between "passed" and "blocked" — is **f_c = 1 / (2π · R · C)**. Calculator card example: R = 10 kΩ, C = 100 nF gives f_c = 1 / (2π · 10000 · 100e-9) = 159 Hz. Below 159 Hz, the signal gets through mostly intact. Above 159 Hz, it gets attenuated at 20 dB/decade (a factor of 10 for every 10× increase in frequency). Typical use cases: smoothing a PWM signal into analog voltage, debouncing a button, anti-aliasing before an ADC.

**[intermediate]** The 2π in the formula is the part that trips people up, and it has a clean origin. The fundamental time-domain behavior of an RC circuit is governed by the **time constant τ = RC** (units: seconds). The capacitor charges or discharges exponentially with this τ — after one time constant, it reaches 63.2% of its final value. Transform this into the frequency domain and the natural variable is **angular frequency ω** (units: radians per second), and the filter's −3 dB point is at **ω_c = 1/τ = 1/(RC) rad/s**. That is the physics — no 2π yet.

The 2π only shows up because humans quote frequency in **hertz** (cycles per second), not radians per second, and there are 2π radians per cycle. So **f = ω / (2π)**, and substituting gives **f_c = ω_c / (2π) = 1 / (2π · RC)**. The 2π is a unit conversion artifact, not a physical constant of the filter. In textbooks that work in ω throughout, you see the clean form ω_c = 1/RC; the messy 2π only appears the moment you say "in Hz."

Why "cutoff" is defined at the −3 dB point specifically: at the cutoff frequency, the capacitor's reactance X_C = 1/(ωC) exactly equals R, which means the RC divider splits the signal 1/√2 in amplitude (the capacitor and resistor are orthogonal vectors of equal magnitude). Amplitude ratio 1/√2 converts to power ratio 1/2, which converts to −3.01 dB — the "half-power point." It is a natural boundary because below it, most of the signal's power is transmitted; above it, most is dissipated in the resistor as heat (and reflected, in transmission-line language).

Phase lag at cutoff is exactly **45°** — the output lags the input by one-eighth of a cycle. Below cutoff, phase lag approaches 0°; above cutoff, it approaches 90°. This matters when an RC filter is inside a feedback loop: a 90° phase shift eats into stability margin, and cascading two RC filters gives 180° at high frequency, which is the condition for oscillation if gain is not rolled off fast enough.

**[expert]** Real components deviate from the ideal model in three ways that bite at the edges:

First, **capacitor tolerance and type** dominate. A 100 nF X7R ceramic has ±10% tolerance and loses 10–50% of its capacitance at rated voltage (DC bias effect); NP0/C0G is dimensionally stable but limited to small values. A filter computed for 159 Hz on paper may actually cutoff at 180 Hz in the circuit because the capacitor's effective C under DC bias is 85 nF. For precision filters, use film caps or C0G ceramics.

Second, **op-amp-buffered or MCU-driven sources** are not ideal voltage sources. Source impedance Z_s adds to R, shifting cutoff to 1/(2π(R+Z_s)C). A GPIO pin driving through 10 kΩ with an 800 Ω output impedance shifts the calculated cutoff by ~8%. And on the output side, any downstream load Z_load is in parallel with C, modifying the effective reactance at high frequency.

Third, **parasitics set the high-frequency floor**. Every resistor has a parallel parasitic capacitance (~0.1–1 pF for 0603), and every capacitor has series inductance (ESL, typically 0.5–2 nH for 0603 ceramics). These create unintended poles and zeros at tens of MHz. For audio/sub-MHz filters, ignore these. For RF or high-speed digital, the "simple RC filter" model is inadequate — use S-parameters and a real EM simulator.

Dual identity: a **highpass** filter (cap in series, resistor to ground) has the same cutoff formula f_c = 1/(2πRC) but attenuates below it instead of above. The algebra is symmetric; only the roles of R and C in the divider swap.

---

Relevant Notes:
- [[ohms-law-v-equals-i-times-r-derivation]] — the DC equivalent identity; at DC, X_C = ∞ and the filter becomes a no-op
- [[voltage-divider-formula-and-loading-effect]] — the RC filter is a complex-impedance voltage divider where C replaces R2
- [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] — decoupling is the same RC filter with R being the supply's source impedance
- [[decoupling-cap-sizing-rule-of-thumb-vs-impedance-curve]] — impedance-curve-based sizing is the same RC math over a frequency sweep

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
- [[passives]]
