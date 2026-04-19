---
_schema:
  entity_type: knowledge-note
  applies_to: knowledge/*.md
description: Passive package codes like 0603 and 1206 are imperial inch-based (0.06" × 0.03")...
type: reference
confidence: proven
topics:
- moc-component-metadata-fields
- eda-fundamentals
- eda-pcb-design
related_components: []
---
# component package type imperial 0603 and metric 1608 are the same physical part with different naming conventions

Package type is the physical body specification. It is the single biggest source of beginner confusion because two completely different naming systems are used side-by-side and nobody tells you which is which.

## Passive chip packages: imperial vs metric

For two-terminal SMT chip passives (resistors, capacitors, inductors), the package code is a four-digit number encoding length × width:

| Imperial code | Physical size (inches) | Metric equivalent | Physical size (mm) |
|---------------|----------------------|-------------------|--------------------|
| 0201 | 0.024 × 0.012 | 0603 | 0.6 × 0.3 |
| 0402 | 0.04 × 0.02 | 1005 | 1.0 × 0.5 |
| 0603 | 0.06 × 0.03 | 1608 | 1.6 × 0.8 |
| 0805 | 0.08 × 0.05 | 2012 | 2.0 × 1.25 |
| 1206 | 0.12 × 0.06 | 3216 | 3.2 × 1.6 |

The trap: **imperial 0603 and metric 0603 are completely different parts.** Metric 0603 is imperial 0201 — roughly grain-of-sand sized. Imperial 0603 is metric 1608 — the common hobbyist default. Datasheets usually label which convention they use, but not always; in the US and for hobbyist parts, **imperial is the default**. EDA tool libraries need the convention stamped explicitly or the BOM becomes a lottery.

The usable floor for hand-soldering is imperial 0603 (metric 1608); below that, surface tension, breath, and tweezer tolerance stop cooperating without magnification and paste stencils.

## IC packages: JEDEC and IPC naming

Integrated circuits do not use the dimension-coded convention. Instead they use JEDEC outline names or IPC-7351 land-pattern names that encode **lead style + pitch + pin count**:

- **SOIC-8** — Small Outline IC, 8 leads, gull-wing, 1.27mm pitch (wide body variants exist)
- **TSSOP-14** — Thin-Shrink SO, 14 leads, 0.65mm pitch
- **QFN-32** — Quad Flat No-lead, 32 pads on a bottom-only rectangular grid, typically 0.5mm pitch
- **BGA-256** — Ball Grid Array, 256 solder balls on a 2D grid, 0.5-1.0mm pitch
- **DIP-16** — Dual Inline Package, 16 through-hole pins, 2.54mm pitch, 7.62mm body width
- **TO-92** — transistor outline 92, three-lead THT plastic body
- **SOT-23** — Small Outline Transistor, three-lead SMT, 0.95mm pitch

Here the trap is different: **the same pin count can live in wildly different body sizes.** SOIC-8 and TSSOP-8 both have eight pins but TSSOP is roughly one-third the area. A DIP-14 and an SOIC-14 are the same chip, same pinout, same data — totally different footprints, totally different assembly.

## Why it matters to the EDA model

Package is the field that generates the footprint (copper + mask + paste + silkscreen). Get it wrong and:

- Pads are the wrong size → parts tombstone, bridge, or float off
- Pitch is wrong → leads miss pads entirely
- Thermal pad is missing on QFN/DFN → IC overheats and throttles or dies
- Land-pattern density is wrong for process → solderability fails at assembly

Since [[ai-component-generation-requires-rigorous-dimension-and-electrical-limit-research-instead-of-hallucinated-approximations]], the package field must be populated from the datasheet's recommended land pattern, ideally matching IPC-7351 naming so that standard footprint libraries resolve the geometry automatically.

---

Relevant Notes:
- [[component-family-groups-parts-by-electrical-role-not-by-manufacturer-or-package]] — family is invariant across packages
- [[component-mounting-type-separates-tht-from-smt-and-governs-assembly-workflow-not-electrical-behavior]] — package implies mounting (SOT-23 is SMT, TO-92 is THT) but they are tracked as separate fields
- [[to-92-package-limits-power-dissipation-to-625mw-and-requires-derating-above-25c-making-thermal-math-mandatory-for-high-current-switching]] — a package name carries real thermal consequences
- [[1088as-pin-numbering-is-non-sequential-across-rows-and-columns-making-orientation-verification-mandatory]] — package also carries pin-numbering orientation that the footprint library encodes

Topics:
- [[moc-component-metadata-fields]]
- [[eda-fundamentals]]
- [[eda-pcb-design]]
