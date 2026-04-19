---
_schema:
  entity_type: knowledge-note
  applies_to: knowledge/*.md
description: Voltage divider Vout = Vin · R2/(R1+R2) is a direct Ohm's Law consequence that holds only when downstream load impedance is at least 10×...
type: reference
confidence: proven
topics:
- moc-electronics-math
- eda-fundamentals
- passives
---
# voltage divider formula and loading effect

**[beginner]** A voltage divider is two resistors in series from your supply to ground, with the output tapped between them. The formula is **Vout = Vin · R2/(R1+R2)** where R2 is the resistor on the ground side. Calculator card example: Vin = 12 V, R1 = 10 kΩ, R2 = 5 kΩ, so Vout = 12 · 5000/15000 = 4.0 V. The divider is the universal "how do I turn a 12 V battery signal into something a 3.3 V ADC can read?" answer, and it is the pattern behind every resistive sensor (thermistor, LDR, potentiometer) where one of the two resistors is the sensor.

**[intermediate]** The derivation is three lines. In a series loop with no load, the same current I flows through both resistors (Kirchhoff's current law). By Ohm's Law, I = Vin/(R1+R2). The voltage across R2 is I·R2 = Vin · R2/(R1+R2). Done. The formula is not a new physical principle — it is Ohm's Law applied twice with the series-current constraint from KCL.

The catch is the **loading effect**. The derivation assumed "no load" — no current flowing out of the Vout node into whatever is reading it. In practice, whatever the divider feeds (an ADC input, a transistor base, an op-amp input, another stage) has some finite input impedance Z_load, and that Z_load appears **in parallel with R2**. The effective lower resistor becomes R2 ‖ Z_load = (R2 · Z_load) / (R2 + Z_load), which is always less than R2, so the output voltage droops below the unloaded prediction.

The rule of thumb everyone uses: **keep Z_load ≥ 10 × R2** for < ~5% sag. If Z_load is 100× R2, error drops to ~1%. If Z_load ≈ R2, the formula is catastrophically wrong — the output voltage drops to roughly half its unloaded value. This is why divider-based sensor conditioning targets high-impedance loads (MCU ADC inputs are typically 100 MΩ; divider R2 values in the 1–100 kΩ range are safe) and fails instantly if you try to "drive" a low-impedance load like an LED or motor through a divider.

**[expert]** The practical design dial is the **stiffness vs power trade-off**. Making R1 and R2 smaller (say, hundreds of ohms instead of tens of kΩ) makes the divider "stiff" — Z_load's effect is negligible even for modest loads — but it burns more quiescent current (P = Vin²/(R1+R2)), which is unacceptable for battery-powered designs. Making R1 and R2 larger saves power but makes the node susceptible to loading, and at very high values (MΩ range) it also becomes susceptible to PCB leakage, flux residue conductivity, and capacitive coupling from adjacent traces — so MΩ dividers are used with guard rings and solder-mask discipline.

When the 10× rule cannot be met (e.g., driving the base of a BJT, which has low input impedance that varies with collector current), the fix is **buffering**: put an op-amp voltage follower between the divider and the load, or use a JFET/MOSFET source follower. The op-amp draws microamps from the divider and delivers milliamps (or more) to the load, decoupling the divider math from the downstream circuit. This is the single most common use of op-amps in sensor front-ends.

A second expert gotcha is **AC loading**: even if DC Z_load is huge, the load may present significant capacitance (scope probes are classic — 10 pF at the tip). At high frequencies, the divider's high-impedance node becomes a low-pass filter with the load capacitance, so a 100 kΩ R2 and 10 pF probe C gives a pole at 160 kHz — anything above that is attenuated before the ADC sees it. ADC-reading resistor dividers for battery monitoring are DC-dominant and do not hit this; dividers feeding fast comparators or hitting MHz-range signals do.

The [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]] note is a worked instance of this math used for lithium-ion pack monitoring.

---

Relevant Notes:
- [[ohms-law-v-equals-i-times-r-derivation]] — the parent identity; divider formula is two applications of it
- [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]] — worked example of divider for ADC input
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]] — potentiometer is a divider where the tap moves
- [[resistive-sensors-require-voltage-divider-to-convert-resistance-changes-into-adc-readable-voltages]] — sensor application pattern
- [[potentiometer-20-percent-resistance-tolerance-is-irrelevant-in-voltage-divider-mode-because-output-depends-on-wiper-position-ratio-not-absolute-resistance]] — why divider mode is tolerance-insensitive

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
- [[passives]]
