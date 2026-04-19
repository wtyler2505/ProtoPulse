---
_schema:
  entity_type: "topic-map"
  applies_to: "knowledge/*.md"
description: "Topic map for the four canonical component-editor metadata fields — family, mounting type, package type, MPN — explaining what each field means, why they are tracked separately, and how they combine to uniquely identify a part in the ProtoPulse parts model"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[eda-schematic-capture]]"
  - "[[eda-pcb-design]]"
  - "[[index]]"
---

# moc-component-metadata-fields

The ProtoPulse component editor exposes four top-level metadata fields on every part: **Family**, **Mounting Type**, **Package Type**, and **MPN**. These are deliberately separate axes. They look overlapping to beginners, but each one resolves a different question and each one drives different downstream behavior.

## Why four fields, not one

A naive parts model uses a single "part type" string. It falls apart immediately:

- Searching for "all resistors regardless of package" is impossible if package is baked into type
- Swapping a THT 2N3904 for an SMT MMBT3904 requires changing the type string (wrong — they are the same family)
- BOM procurement needs MPN resolution without knowing the symbol the schematic used
- Footprint libraries key off package alone, independent of family

Splitting the metadata into four orthogonal axes makes each query cheap and each swap local:

| Field | Answers | Drives |
|-------|---------|--------|
| Family | What kind of thing is this, electrically? | Symbol, SPICE model, ERC rules |
| Mounting | How does it attach to the board? | Footprint style (holes vs pads), assembly order |
| Package | What is the physical body? | Footprint geometry (size, pitch, thermal pad) |
| MPN | Who made this exact part? | BOM, procurement, datasheet lookup |

## Field Definitions

- [[component-family-groups-parts-by-electrical-role-not-by-manufacturer-or-package]] — family is the top-level taxonomic bucket that decides symbol, simulation model, and DRC treatment; independent of package and MPN
- [[component-mounting-type-separates-tht-from-smt-and-governs-assembly-workflow-not-electrical-behavior]] — THT / SMT / mixed / press-fit / socketed; orthogonal to family and electrical behavior
- [[component-package-type-imperial-0603-and-metric-1608-are-the-same-physical-part-with-different-naming-conventions]] — imperial vs metric passive codes, JEDEC / IPC-7351 IC names, and the traps between them
- [[component-mpn-is-the-manufacturer-contract-and-supplier-sku-is-the-distributor-contract-and-only-mpn-is-stable-across-sources]] — MPN as canonical identity; supplier SKUs as disposable resolution metadata

## How the fields combine

A fully specified part is `(family, mounting, package, MPN)`. Different completion levels unlock different workflows:

| Specified | Usable for |
|-----------|------------|
| family only | Schematic draft, behavioral simulation |
| family + package | Footprint placement, DRC, board outline check |
| family + mounting + package | Full PCB layout, assembly-aware rules |
| all four | BOM export, procurement, manufacturable design |

The component editor encourages but does not force this order. A schematic capture session often fills `family` and leaves the others empty until PCB layout; BOM export re-prompts for anything missing.

## Audience tiers

Each field note follows a beginner → intermediate → expert arc:

- **Beginner** — what the field is, with a one-sentence definition and a concrete example
- **Intermediate** — the tradeoffs, common confusions, and naming-convention gotchas
- **Expert** — supplier-side mechanics, manufacturer naming encodings, and EDA-tool-specific quirks

## Related topic maps

- [[eda-fundamentals]] — parent domain hub
- [[eda-schematic-capture]] — where family and MPN matter most
- [[eda-pcb-design]] — where mounting and package matter most
- [[passives]] — where package codes (0603, 1206) and MPN variants are thickest on the ground
- [[microcontrollers]] — where MPN variants drive pinout differences

## Open Questions

- Should `family` be a flat enum or a hierarchy (e.g., `transistor > BJT > NPN`)? Hierarchy helps ERC; flat enum is simpler for the UI.
- How should the model represent drop-in replacement sets (Yageo → Panasonic 10kΩ 0603 equivalence) without forcing users to MPN-lock?
- Is `socketed` a mounting type or a board-level property (the socket is soldered, the part is plugged)?

## Source

- [[2026-04-19-component-editor-field-definitions-moc]] — gap stub from T4 Directed MOC Expansion

---

Topics:
- [[eda-fundamentals]]
- [[eda-schematic-capture]]
- [[eda-pcb-design]]
- [[index]]
