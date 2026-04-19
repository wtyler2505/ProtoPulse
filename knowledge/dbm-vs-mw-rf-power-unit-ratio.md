---
_schema:
  entity_type: "knowledge-note"
  applies_to: "knowledge/*.md"
description: "dBm is power expressed as a logarithmic ratio against a fixed 1 mW reference: dBm = 10·log₁₀(P/1mW), so 0 dBm ≡ 1 mW, +10 dBm = 10 mW, +20 dBm = 100 mW, and +3 dBm ≈ ×2 power; the log-scale exists because RF chains add gains and losses additively in dB where they would multiply in linear units"
type: concept
confidence: proven
topics:
  - "[[moc-electronics-math]]"
  - "[[eda-fundamentals]]"
---

# dbm vs mw rf power unit ratio

**[beginner]** dBm is the unit RF engineers use for power. It is decibels relative to 1 milliwatt. The conversion formulas are:

- **dBm = 10 · log₁₀(P_mW)** — convert milliwatts to dBm
- **P_mW = 10^(dBm/10)** — convert dBm back to milliwatts

Key values everyone remembers: **0 dBm = 1 mW**, **+10 dBm = 10 mW**, **+20 dBm = 100 mW**, **+30 dBm = 1 W**, **−30 dBm = 1 μW**. Calculator card example: a Wi-Fi transmitter rated at +20 dBm outputs 100 mW; a Bluetooth LE beacon at 0 dBm outputs 1 mW; a received signal at −80 dBm is 10 pW (10 picowatts — a trillion times weaker than a 10 mW transmit signal). The minus sign simply means "below 1 mW."

**[intermediate]** The two reasons for the log scale are practical, not cosmetic:

First, **RF systems span huge dynamic ranges**. A typical receive chain might see signals from −110 dBm (faint, near thermal noise) up to −10 dBm (strong nearby transmitter) — that is 10 orders of magnitude in linear power (10^−14 W to 10^−4 W). Writing those as "0.00000000001 W" vs "0.0001 W" is unreadable; writing them as −110 dBm vs −10 dBm is one-glance legible.

Second, **gains and losses combine additively in dB** where they would multiply in linear units. A signal path with a +15 dB amplifier followed by a 3 dB cable loss followed by a 6 dB filter loss arrives at 15 − 3 − 6 = +6 dB relative to the input. The equivalent linear math is ×31.6 × 0.5 × 0.25 = ×3.98 — same answer (10^(6/10) = 3.98), but the log form is mental arithmetic and the linear form needs a calculator. Every link budget, antenna system, and RF chain is specified in dB for this reason.

Useful shortcuts derive from the log nature:

- **+3 dB ≈ ×2 power** (exactly: 10^0.3 = 1.995). Half-power is −3 dB, which is why filter cutoff is defined at −3 dB.
- **+10 dB = ×10 power** (by definition of the log scale)
- **+20 dB = ×100 power** (two decades)
- **Adding 3 dB doubles, subtracting 3 dB halves** — the bit of RF mental math that covers 80% of cases

dBm measures power; **dB alone** (no suffix letter) measures a ratio with no absolute reference — a 10 dB amplifier amplifies by ×10 in power regardless of absolute level. **dBW** is decibels relative to 1 watt (1 W = 0 dBW = +30 dBm; broadcast transmitters are usually quoted in dBW). **dBc** is decibels relative to the carrier (used for spurious and harmonic specs). The suffix letter is critical: "+20" by itself is meaningless; +20 dBm, +20 dB, and +20 dBW are all different.

**[expert]** Three places this gets subtle:

First, **voltage in dB is different from power in dB by a factor of 2**. Since power goes as V²/R, a voltage ratio of ×10 corresponds to a power ratio of ×100 = +20 dB. The formula for voltage ratios expressed in dB is **dB = 20 · log₁₀(V_ratio)**, with the 20 (not 10) absorbing the squared relationship. Spec sheets often mix these: an op-amp's "60 dB open-loop gain" is a voltage gain of 1000 (not 1 million), because op-amp gain is voltage gain. An RF amp's "20 dB gain" is a power gain of 100. Reading the wrong formula gives an answer off by a factor of 10 in voltage or 100 in power. The convention is: **dB on power uses 10·log, dB on voltage uses 20·log**, and the context usually makes it clear — but not always.

Second, **dBm to voltage requires an impedance assumption**. Converting 0 dBm (1 mW) to volts depends on what impedance the power is delivered into. RF convention is 50 Ω, giving 0 dBm = 0.224 V RMS = 632 mVpp. Audio convention is 600 Ω, giving 0 dBm at a different voltage. Test equipment defaults to 50 Ω unless it is an audio analyzer. The conversion formula is **V_RMS = √(P·R) = √(10^(dBm/10) · 10⁻³ · R)**. Scope probes that display "dBV" or "dBmV" use 1 V or 1 mV references independent of impedance, which decouples them from the 50 Ω assumption — but they also decouple from absolute power, which is what most RF problems need.

Third, **noise specs mix in funny units**. Noise density is quoted in dBm/Hz (power per unit bandwidth) or dBc/Hz (relative to carrier per unit bandwidth, for phase noise). Integrating over a bandwidth requires +10·log(BW) to get total noise power. A phase noise floor of −120 dBc/Hz integrated over a 10 kHz bandwidth is −120 + 40 = −80 dBc of integrated noise relative to carrier. The bandwidth correction is an easy missed term when reading phase-noise plots for the first time.

For simple transmit-power and receive-sensitivity problems, dBm = 10·log(P_mW) and its inverse are all you need. The complications above only matter when the answer has to be precise to single dB — link budgeting for regulatory compliance, for example, or spec-sheet math for a receiver noise floor.

---

Relevant Notes:
- [[moc-electronics-math]] — parent MOC
- [[rc-lowpass-cutoff-frequency-1-over-2-pi-rc]] — the −3 dB point (half-power) is where cutoff is defined, directly using the dB scale

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
