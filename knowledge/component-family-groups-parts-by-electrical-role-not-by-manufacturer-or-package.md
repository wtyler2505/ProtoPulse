---
_schema:
  entity_type: "knowledge-note"
  applies_to: "knowledge/*.md"
description: "Component family is the electrical-role taxonomy — resistor / capacitor / BJT / MOSFET / microcontroller / connector — that decides which symbol, which simulation model, and which DRC rules apply, and it is deliberately independent of package, manufacturer, and MPN"
type: concept
confidence: proven
topics:
  - "[[moc-component-metadata-fields]]"
  - "[[eda-fundamentals]]"
  - "[[eda-schematic-capture]]"
related_components: []
---

# component family groups parts by electrical role not by manufacturer or package

In an EDA parts model, **family** is the top-level taxonomic bucket that answers the question *what kind of thing is this, electrically?* A 10kΩ 0603 resistor and a 1MΩ 1206 resistor are the same family (resistor) even though they share no MPN, no package, and no supplier. Conversely, a 2N3904 BJT in TO-92 and a BSS138 MOSFET in SOT-23 are both three-terminal through-hole-ish transistors, but they are **different families** because they obey different Ohm-vs-square-law equations, need different SPICE models, and trigger different DRC polarity rules.

Family matters because it is the field the rest of the component editor keys off:

- **Symbol selection** — the schematic symbol is a family property, not an MPN property; every resistor uses the same zigzag (or rectangle in IEC) regardless of value or package
- **Simulation model** — SPICE primitives are keyed by family (R, C, L, Q, M, D); without family, the netlist generator has no idea what equation to use
- **ERC rules** — `passives` ignore pin-type checks that `ICs` enforce; `connectors` are treated as nets-off-board; `mechanical` family items are excluded from electrical rules entirely
- **BOM grouping** — procurement wants "all 10kΩ resistors" as one line regardless of supplier, which only works if family is the grouping key

Families split along three natural axes that beginners often conflate:

1. **Passive vs active** — a passive family (resistor, capacitor, inductor) cannot amplify; an active family (BJT, MOSFET, op-amp, MCU) can. Power supplies and biasing networks key off this split.
2. **Discrete vs integrated** — a single transistor is discrete; a 555 timer or ATmega328P is integrated (an IC family). Footprint libraries, pin-count conventions, and package taxonomies differ sharply between the two.
3. **Electrical vs mechanical** — standoffs, screws, heatsinks, and enclosure hardware are a `mechanical` family; they appear in the BOM and the 3D view but carry no net connections.

The anti-pattern is treating family as a marketing category ("Arduino-compatible modules") or as a package synonym ("SOIC parts"). Both break as soon as you try to swap a through-hole 2N3904 for a SMD MMBT3904 — same family, different package, identical symbol and model. Since [[ai-component-generation-requires-rigorous-dimension-and-electrical-limit-research-instead-of-hallucinated-approximations]], family must be assigned from the datasheet's *device type*, not from the part's physical appearance.

---

Relevant Notes:
- [[component-mounting-type-separates-tht-from-smt-and-governs-assembly-workflow-not-electrical-behavior]] — mounting is orthogonal to family; a resistor family member can be TH or SMT
- [[component-package-type-imperial-0603-and-metric-1608-are-the-same-physical-part-with-different-naming-conventions]] — package is orthogonal to family; same family spans many packages
- [[component-mpn-is-the-manufacturer-contract-and-supplier-sku-is-the-distributor-contract-and-only-mpn-is-stable-across-sources]] — MPN is below family in the taxonomy

Topics:
- [[moc-component-metadata-fields]]
- [[eda-fundamentals]]
- [[eda-schematic-capture]]
