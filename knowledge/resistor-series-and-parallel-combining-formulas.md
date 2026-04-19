---
_schema:
  entity_type: knowledge-note
  applies_to: knowledge/*.md
description: Series resistors add (R_total = ΣR); parallel resistors combine as reciprocal-of-sum-of-reciprocals (1/R_total = Σ 1/Rᵢ)...
type: reference
confidence: proven
topics:
- moc-electronics-math
- eda-fundamentals
- passives
---
# resistor series and parallel combining formulas

**[beginner]** Two resistors in series (end-to-end): add them. 10 kΩ + 4.7 kΩ = 14.7 kΩ. Two resistors in parallel (side-by-side, both ends connected): use the product-over-sum shortcut, R1·R2/(R1+R2). 10 kΩ in parallel with 10 kΩ = 100/20 = 5 kΩ — two equal resistors in parallel always equal half. The calculator card takes any list of resistors and a mode (series or parallel) and returns the equivalent single resistance. You reach for these whenever you need a value you do not have in stock: need 15 kΩ, have 10 k and 4.7 k — series them. Need 5 kΩ, have two 10 kΩ — parallel them.

**[intermediate]** Both formulas drop out of Ohm's Law plus Kirchhoff's two laws applied to the relevant topology.

**Series derivation:** Two resistors end-to-end share the same current I (KCL — no junction in between). The total voltage across the pair is V_total = V1 + V2 (KVL around the loop). By Ohm's Law, V1 = I·R1 and V2 = I·R2, so V_total = I·(R1 + R2). The equivalent single resistance is defined as V_total/I = R1 + R2. Extends trivially to N resistors: R_series = Σ Rᵢ.

**Parallel derivation:** Two resistors with their ends tied together share the same voltage V (KVL — they are connected to the same two nodes). The total current is I_total = I1 + I2 (KCL at the top junction). By Ohm's Law, I1 = V/R1 and I2 = V/R2, so I_total = V·(1/R1 + 1/R2). The equivalent is V/I_total = 1/(1/R1 + 1/R2). Extends to N: 1/R_parallel = Σ 1/Rᵢ. The two-resistor form simplifies to R1·R2/(R1+R2) by multiplying numerator and denominator by R1·R2.

Two invariants worth memorizing because they catch arithmetic errors instantly:

- **A parallel combination is always less than the smallest resistor in it.** 10 kΩ ‖ 1 kΩ must be less than 1 kΩ (it is 909 Ω). If your calculation gives something bigger than the smallest, you used the wrong formula.
- **A series combination is always greater than the largest resistor in it.** 10 kΩ + 100 Ω must be more than 10 kΩ (it is 10.1 kΩ). If your calculation gives something smaller, you dropped a term.

**When to use which:** Series for *dividing voltage* (two resistors across a supply give a fraction at the midpoint — see the voltage divider). Parallel for *dividing current* or *lowering resistance from available stock*. Parallel also reduces tolerance: three 3-kΩ ±5% resistors in parallel produce a 1 kΩ ±~2.9% equivalent because random errors partially cancel (RMS combine).

**[expert]** Three caveats beginners hit in practice:

First, **power dissipation splits differently**. In series, each resistor dissipates in proportion to its resistance (P_i = I² · R_i — bigger R burns more because the same current passes through, and the voltage drop is larger). In parallel, each resistor dissipates in inverse proportion (P_i = V² / R_i — smaller R burns more because more current flows through it). When paralleling resistors to share load (e.g., making a high-wattage sense resistor from four 1 W parts), use matched values or the unbalanced one overheats first.

Second, **tolerance does not average linearly**. Two 1% resistors in series give a combination whose *absolute* tolerance is the sum (1% + 1% = 2% absolute in the worst case) but whose *relative* tolerance is still ~1% if the errors are uncorrelated (RMS combine to √2% ≈ 1.4%). Many designers get this wrong and over-spec tolerance when combining identical values.

Third, **parasitics matter at frequency**. Resistors have parallel parasitic capacitance (tens of fF to ~1 pF depending on package and value); at high frequency, two "parallel" resistors are actually two RC networks in parallel, and the combination is frequency-dependent. Current-sense resistors used in switching supplies have to account for inductance as well — a wirewound 0.1 Ω resistor might have 100 nH of parasitic inductance, dominating the measurement above a few MHz.

The **Y–Δ (wye-delta) transformation** is the more general relative of series/parallel reduction: it converts between three-resistor triangle and three-resistor star networks. Calculators that only do series/parallel cannot simplify a Wheatstone bridge or a more complex three-terminal network; that needs mesh analysis or Y–Δ. For the Calculators tab's scope, series and parallel are sufficient.

---

Relevant Notes:
- [[ohms-law-v-equals-i-times-r-derivation]] — the parent identity; both combination formulas are derivations from it plus Kirchhoff's laws
- [[voltage-divider-formula-and-loading-effect]] — loading effect is a parallel combination of R2 with Z_load
- [[hardware-component-resistor-10k]] — practical 10 kΩ stock used in combining
- [[hardware-component-resistor-100]] — practical 100 Ω stock used in combining

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
- [[passives]]
