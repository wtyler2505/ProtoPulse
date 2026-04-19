---
_schema:
  entity_type: topic-map
  applies_to: knowledge/*.md
description: Topic map indexing the foundational formulas used by every calculator card in the ProtoPulse Calculators tab — Ohm's Law...
type: moc
topics:
- eda-fundamentals
- passives
- index
---
# moc-electronics-math

The ProtoPulse Calculators tab exposes a fixed set of everyday electronics formulas: Ohm's Law, voltage divider, RC cutoff, series/parallel resistor combining, mil↔mm, AWG↔mm², dBm↔mW, LED current-limiting resistor, inductor flyback, and decoupling cap sizing. Each calculator card links into this MOC, which in turn points at the atomic derivation note for each formula.

The pedagogical goal is that every formula in the UI is traceable to an externalized derivation. A maker who types values into the LED resistor calculator and wonders *why* it subtracts Vf before dividing by If can follow one click into [[led-current-limiting-resistor-sizing-and-thermal-derating]] and read the reasoning. Calculators without that backing are black boxes; calculators with this MOC become teaching tools.

## Why a math MOC, separate from the hardware MOCs

[[passives]] and [[eda-fundamentals]] already index component-level knowledge (what a resistor *is*, what a capacitor *does*). This MOC indexes **formulas** — the equations that connect component values to circuit behavior. Families of notes that belong here:

- **Definitional identities** — Ohm's Law as the definition of resistance, not a derived law
- **Derived relationships** — the voltage divider ratio is V·R2/(R1+R2), derivable in two lines from Ohm's Law + KCL
- **Unit system bridges** — mil↔mm and AWG↔mm² are conversions, not physics, but they bite every PCB project
- **Logarithmic units** — dBm is a power ratio expressed in a different number system
- **Sizing heuristics** — decoupling cap sizing and LED resistor sizing mix physics with rules-of-thumb

## Core Formulas

- [[ohms-law-v-equals-i-times-r-derivation]] — the definition of resistance, not an empirical law; units carry the derivation
- [[voltage-divider-formula-and-loading-effect]] — two-resistor ratio and the 10× rule for when it breaks
- [[rc-lowpass-cutoff-frequency-1-over-2-pi-rc]] — the 2π comes from converting angular frequency (rad/s) to Hz; cutoff is the −3 dB (half-power) point
- [[resistor-series-and-parallel-combining-formulas]] — series sums, parallel is reciprocal-sum; parallel is always less than the smallest contributor
- [[led-current-limiting-resistor-sizing-and-thermal-derating]] — (Vsource − Vf) / If is the first-pass; thermal derating and MCU GPIO budget modify the answer
- [[inductor-flyback-voltage-v-equals-l-di-dt]] — sudden current interruption in an inductor produces an unbounded voltage spike; the minus sign dictates snubber topology
- [[decoupling-cap-sizing-rule-of-thumb-vs-impedance-curve]] — 100 nF everywhere is the beginner heuristic; real sizing is impedance-vs-frequency over the IC's switching spectrum

## Unit Conversions

- [[mil-vs-mm-pcb-unit-exact-conversion]] — 1 mil = 0.0254 mm exactly (the inch itself was redefined to 25.4 mm in 1959)
- [[awg-vs-mm2-wire-sizing-logarithmic-conversion]] — AWG is a 39-step log scale between two anchors; every 3 gauge steps doubles area
- [[dbm-vs-mw-rf-power-unit-ratio]] — 0 dBm ≡ 1 mW; dBm = 10·log₁₀(P/1mW); every +3 dBm is roughly ×2 power

## Audience tiers

Every child note follows a three-tier arc written in prose, tagged inline:

- **[beginner]** — the formula as an input/output recipe, with one worked example using values the calculator card uses
- **[intermediate]** — the derivation (why the formula has the shape it does, what it is saying about the physics)
- **[expert]** — the real-world caveats that the formula does not capture: tolerance stack-up, thermal derating, parasitic elements, frequency-dependence, measurement instrument loading

## Calculator ↔ note mapping

| Calculator card | Backing note |
|-----------------|--------------|
| Ohm's Law | [[ohms-law-v-equals-i-times-r-derivation]] |
| Voltage Divider | [[voltage-divider-formula-and-loading-effect]] |
| RC Low-Pass | [[rc-lowpass-cutoff-frequency-1-over-2-pi-rc]] |
| Resistor Combiner | [[resistor-series-and-parallel-combining-formulas]] |
| LED Resistor | [[led-current-limiting-resistor-sizing-and-thermal-derating]] |
| Flyback Voltage | [[inductor-flyback-voltage-v-equals-l-di-dt]] |
| Decoupling Cap | [[decoupling-cap-sizing-rule-of-thumb-vs-impedance-curve]] |
| mil ↔ mm | [[mil-vs-mm-pcb-unit-exact-conversion]] |
| AWG ↔ mm² | [[awg-vs-mm2-wire-sizing-logarithmic-conversion]] |
| dBm ↔ mW | [[dbm-vs-mw-rf-power-unit-ratio]] |

## Related topic maps

- [[eda-fundamentals]] — parent EDA domain hub; this MOC sits under it as the "math" axis
- [[passives]] — where R, C, L component knowledge lives; the formulas here operate on those components
- [[moc-component-metadata-fields]] — sibling MOC for the component editor's metadata axes

## Open Questions

- Should capacitor/inductor impedance formulas (X_C = 1/(2πfC), X_L = 2πfL) be separate notes, or folded into the RC cutoff note? They recur in every reactive-component discussion.
- Is there a 11th formula the Calculators tab should expose — power dissipation (P = I²R), time constant τ = RC as a distinct concept, or Thevenin/Norton reduction?
- Does the LED resistor calculator card need a separate "parallel LEDs" note, or is that a failure mode rather than a math formula?

## Source

- [[2026-04-19-electronics-math-calculator-formulas-moc]] — gap stub from T4 Directed MOC Expansion, unblocks Wave 4 Task 4.3 of 15-generative-digital-twin-exports.md

---

Topics:
- [[eda-fundamentals]]
- [[passives]]
- [[index]]
