---
_schema:
  entity_type: "knowledge-note"
  applies_to: "knowledge/*.md"
description: "Ohm's Law V = I·R is the definition of resistance, not an empirical law discovered by experiment; it says that for ohmic materials, the ratio of voltage to current is a constant we call resistance, and that ratio is what a multimeter's resistance mode actually measures"
type: concept
confidence: proven
topics:
  - "[[moc-electronics-math]]"
  - "[[eda-fundamentals]]"
  - "[[passives]]"
---

# ohms law v equals i times r derivation

**[beginner]** If you push 1 volt across a 1-ohm resistor, 1 amp flows. Double the voltage, double the current. Half the voltage, half the current. The formula V = I·R (or its rearrangements I = V/R, R = V/I) is the single most-used equation in electronics because every current-limiting, voltage-dividing, power-calculating problem reduces to it. A concrete example the Calculators tab uses: push 5 V across a 1 kΩ resistor, the current is 5 V / 1000 Ω = 5 mA — safely under any MCU GPIO budget.

**[intermediate]** The water-pressure analogy beginners are taught (V = pressure, I = flow, R = pipe constriction) is useful for building intuition but dangerous as a derivation because it implies Ohm's Law is a physical observation about nature. It is not. Ohm's Law is really a **definition of resistance**: for a class of materials called *ohmic*, voltage and current are linearly proportional, and the constant of proportionality is what we choose to name "resistance." The formula is not saying "nature obeys V = IR" — it is saying "if V and I are linearly related, we will write that relationship as V = IR and call the slope R."

This matters because plenty of real components are **non-ohmic** and do not obey V = IR in the naive way:

- Diodes have an exponential V–I relationship (the Shockley equation); their "resistance" is a slope that changes with operating point
- Incandescent bulbs change resistance with temperature, so a cold bulb and a hot bulb have different R values for the same nominal part
- Transistors, LEDs, varistors, thermistors — all non-ohmic by design

Ohmic resistors are a well-behaved subset where the slope is constant across the operating range, and for those, V = IR is usable without caveat. The water analogy breaks when current heats the resistor and changes its resistance, because water pipes do not change diameter as water flows through them.

**[expert]** The formal statement of the local form of Ohm's Law is **J = σE**, where J is current density (A/m²), σ is conductivity (S/m, the reciprocal of resistivity), and E is electric field (V/m). This is the material-physics version; the familiar V = IR form comes from integrating this local form along the length of a uniform conductor. Resistivity ρ (Ω·m) is the intrinsic property of the material; resistance R of a specific part is then R = ρ·L/A — length over cross-section times the material's resistivity. This is the formula behind every PCB trace width calculator: the trace's resistance is determined by its length, copper thickness (typically 1 oz/ft² = 35 μm), and width.

The definition-not-law view has a practical payoff: when debugging a circuit and a multimeter says "V and I disagree with V = IR by 30%," it is not nature that is broken — it is one of three things, each of which is a real bug to find. Either the component is not actually ohmic in that operating range (check if it's a diode, LED, or heated resistor), or the measurement has a loading-effect artifact (the meter's internal impedance is in parallel with something), or a hidden current path exists (a second resistor somewhere you forgot). Treating V = IR as inviolable turns "the math is wrong" into "which of the three assumptions is wrong," which is a debuggable question.

Power then falls out by substitution: P = V·I = I²·R = V²/R — three equivalent forms, each convenient in different problems. Current-mode problems (known I, find power) use I²R; voltage-mode problems (known V, find power) use V²/R.

---

Relevant Notes:
- [[voltage-divider-formula-and-loading-effect]] — direct two-line consequence of Ohm's Law + KCL
- [[led-current-limiting-resistor-sizing-and-thermal-derating]] — the canonical Ohm's Law application, with Vf accounting for the LED's non-ohmic drop
- [[resistor-series-and-parallel-combining-formulas]] — Ohm's Law plus Kirchhoff's laws derive both combination rules
- [[330-ohm-resistor-is-the-safe-universal-default-for-any-led-color-at-5v]] — a practical application of V = IR with Vf subtraction

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
- [[passives]]
