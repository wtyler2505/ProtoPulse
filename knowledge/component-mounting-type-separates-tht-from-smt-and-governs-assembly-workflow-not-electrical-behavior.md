---
_schema:
  entity_type: "knowledge-note"
  applies_to: "knowledge/*.md"
description: "Mounting type (THT / SMT / mixed / press-fit / socketed) decides hole-vs-pad footprints, assembly order, and rework difficulty, but does not change a part's schematic symbol or electrical model — an SMT 0603 resistor and a THT axial resistor simulate identically"
type: concept
confidence: proven
topics:
  - "[[moc-component-metadata-fields]]"
  - "[[eda-fundamentals]]"
  - "[[eda-pcb-design]]"
related_components: []
---

# component mounting type separates THT from SMT and governs assembly workflow not electrical behavior

Mounting type answers *how does this part physically attach to the board*. The canonical values in most EDA parts models are:

- **THT** (through-hole technology) — leads pass through drilled holes and solder on the opposite side; what hobbyists solder by hand with an iron
- **SMT** (surface-mount technology) — metal terminations sit on pads on the same side as the body; needs reflow, hot-air, or careful paste-and-iron work
- **Mixed** — the same PCB uses both (realistic for almost every hobbyist board)
- **Press-fit** — compliant-pin connectors that press into plated holes without solder (high-reliability, rework-heavy)
- **Socketed** — the part is not soldered at all; a socket or header is soldered and the part plugs in (DIP-28 ATmega328P in an Uno, Raspberry Pi Pico with headers)

The critical insight is that **mounting is a footprint property, not an electrical one**. A 10kΩ resistor behaves identically whether it is a 0805 SMT chip or a 1/4W axial through-hole part. The schematic symbol is the same, the SPICE model is the same, the ERC check is the same. Only three things change:

1. **Footprint geometry** — pads vs holes, with completely different copper, solder-mask, and paste-mask artwork
2. **Assembly order** — reflow first (SMT), then wave or hand-solder THT; getting the order wrong melts THT plastic
3. **Rework difficulty** — THT is iron-and-wick friendly; SMT above 0402 needs hot air or preheat; BGA is nearly impossible without proper tooling

The hobbyist tradeoff hierarchy for picking mounting type:

| Priority | Pick | Why |
|----------|------|-----|
| Breadboard prototyping | THT | SMT parts don't fit 2.54mm breadboard holes without adapters |
| Hand-soldered PCB, learning | THT or large SMT (1206, SOIC) | Forgiving pad size, wide pitch |
| Compact design, JLCPCB assembly | SMT | Cheaper per part, smaller, assembly services handle it |
| Frequent swap (MCU, EEPROM) | Socketed | Pull-and-replace without desoldering |
| Harsh environment, vibration | Press-fit or THT | No solder joint fatigue |

The anti-pattern is treating "SMT" as a size claim. Modern SMT spans 01005 (0.4mm × 0.2mm, invisible to the naked eye) through power QFNs the size of a postage stamp, and THT spans sub-millimeter pin transistors through axial capacitors the size of a AA battery. Size lives in the **package type**, not in mounting.

For ProtoPulse specifically: because [[breadboarding-requires-tht-headers-or-smt-breakout-boards]] — note intentional implication — the `mounting` field on the part model determines whether a part can be dragged onto the virtual breadboard at all, or whether it must first be wrapped in an SMT-to-DIP adapter.

---

Relevant Notes:
- [[component-family-groups-parts-by-electrical-role-not-by-manufacturer-or-package]] — mounting is orthogonal to family
- [[component-package-type-imperial-0603-and-metric-1608-are-the-same-physical-part-with-different-naming-conventions]] — package encodes the specific SMT or THT body style
- [[to-92-package-limits-power-dissipation-to-625mw-and-requires-derating-above-25c-making-thermal-math-mandatory-for-high-current-switching]] — concrete THT package thermal consequence

Topics:
- [[moc-component-metadata-fields]]
- [[eda-fundamentals]]
- [[eda-pcb-design]]
