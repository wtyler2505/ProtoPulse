---
name: "Electronics math / calculator formulas MOC — vault-gap stub"
description: "Gap flagged by T4 Directed MOC Expansion + 15-generative-digital-twin-exports.md. Every calculator in the Calculators tab needs a vault-backed formula derivation note."
captured_date: 2026-04-19
extraction_status: extracted
extracted_date: 2026-04-19
triage_status: gap-stub
extracted_notes:
  - moc-electronics-math
  - ohms-law-v-equals-i-times-r-derivation
  - voltage-divider-formula-and-loading-effect
  - rc-lowpass-cutoff-frequency-1-over-2-pi-rc
  - resistor-series-and-parallel-combining-formulas
  - mil-vs-mm-pcb-unit-exact-conversion
  - awg-vs-mm2-wire-sizing-logarithmic-conversion
  - dbm-vs-mw-rf-power-unit-ratio
  - led-current-limiting-resistor-sizing-and-thermal-derating
  - inductor-flyback-voltage-v-equals-l-di-dt
  - decoupling-cap-sizing-rule-of-thumb-vs-impedance-curve
source_type: vault-gap-seed
origin:
  plan: docs/superpowers/plans/2026-04-18-arscontexta-system-upgrades.md
  task: T4 Directed MOC Expansion — Electronics Math
coverage_at_gap: partial
strong_hits_at_gap: 4
research_questions:
  - Ohm's Law — derivation from definition of resistance + intuition (water analogy pitfalls)
  - Voltage divider — two-resistor ratio + loading effect (why the formula breaks when load Z ≈ R2)
  - RC lowpass filter cutoff — `f_c = 1 / (2π·RC)` — where does the 2π come from? Phase lag at cutoff?
  - Resistor combinations — series (sum) and parallel (product/sum, or `1/(Σ 1/Rᵢ)`) + when to use which
  - Unit conversions — mil↔mm (exact: 1 mil = 0.0254mm), AWG↔mm² (logarithmic), dBm↔mW (power ratio)
  - LED current-limiting resistor — `(Vsource - Vf) / If` + thermal derating
  - Inductor energy + flyback voltage — `V = -L·di/dt` relevance to relay/motor driver
  - Decoupling cap sizing — rule of thumb vs impedance-curve-based selection
unblocks:
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/15-generative-digital-twin-exports.md (Calculator cards)
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/13-learning-surfaces.md (Learn articles)
topics:
  - vault-gap-seed
  - electronics-math
  - calculator
  - formulas
  - pedagogy
---

## Gap context

15-generative-digital-twin-exports.md Wave 4 Task 4.3 links every calculator card → Learn article. 13-learning-surfaces.md wants every Learn article to have a vault MOC backlink. The vault has partial coverage (some derivations exist per-part, e.g. LED resistor sizing in some LED notes) but no canonical MOC for electronics math pedagogy.

## Primary sources to consult

- Horowitz & Hill, The Art of Electronics (3rd ed.) — Chapters 1-2
- ARRL Handbook
- Khan Academy electrical engineering
- Falstad circuit simulator reference docs
- Existing vault notes (grep `ohms-law`, `voltage-divider`, `rc-filter`, `resistor-sizing`)

## Suggested extraction output

MOC + ~8-10 atomic notes, each with audience tiers:
- `moc-electronics-math.md` — index
- `ohms-law-v-equals-i-times-r-derivation.md`
- `voltage-divider-formula-and-loading-effect.md`
- `rc-lowpass-cutoff-frequency-1-over-2-pi-rc.md`
- `resistor-series-and-parallel-combining-formulas.md`
- `mil-vs-mm-pcb-unit-exact-conversion.md`
- `awg-vs-mm2-wire-sizing-logarithmic-conversion.md`
- `dbm-vs-mw-rf-power-unit-ratio.md`
- `led-current-limiting-resistor-sizing-and-thermal-derating.md`
- `inductor-flyback-voltage-v-equals-l-di-dt.md`
- `decoupling-cap-sizing-rule-of-thumb-vs-impedance-curve.md`

Audience tiers required:
- `[beginner]` — the formula + one worked example
- `[intermediate]` — derivation + where it breaks
- `[expert]` — real-world caveats (tolerance, thermal, parasitic)

## Instructions for /extract

1. Grep vault for existing partial coverage per topic.
2. For each topic, synthesize atomic note with three audience tiers.
3. Create `moc-electronics-math.md` as index + register with `moc-eda-fundamentals.md`.
4. Run `/vault-quality-gate` + `/vault-audience` per note.
5. Update 15-generative plan's Vault Integration TSV entries once slugs are canonical.
6. Mark this stub `extracted` in `ops/queue/gap-stubs.md`.
