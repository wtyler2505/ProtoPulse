---
name: "Component editor field definitions — vault-gap stub"
description: "Gap flagged by T4 Directed MOC Expansion + 09-component-editor.md. Family / Mounting / Package / MPN each need plain-English vault notes."
captured_date: 2026-04-19
extraction_status: pending
triage_status: gap-stub
source_type: vault-gap-seed
origin:
  plan: docs/superpowers/plans/2026-04-18-arscontexta-system-upgrades.md
  task: T4 Directed MOC Expansion — Component Editor
coverage_at_gap: partial
strong_hits_at_gap: 3
research_questions:
  - What is a "component family" in EDA parlance (resistor family vs IC family vs connector family)?
  - Mounting type — what are the canonical values (THT / SMT / mixed / press-fit / socketed) + tradeoffs?
  - Package type — how does the 0603/0805/1206 convention differ from SOIC/QFN/BGA? Imperial vs metric?
  - MPN (Manufacturer Part Number) — what makes an MPN canonical vs variant? How do suppliers encode it?
  - What's the relationship between MPN / Supplier SKU / Generic part? How should ProtoPulse's part model represent this?
  - When is it appropriate to use a generic symbol vs a specific MPN-locked symbol?
unblocks:
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/09-component-editor.md
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/10-procurement-suite.md
topics:
  - vault-gap-seed
  - component-editor
  - eda
  - component-metadata
---

## Gap context

09-component-editor.md Wave 2 Task 2.2 specifies HoverCard definitions for Family, Mounting Type, Package Type, and MPN. Vault has partial coverage (package-type notes exist for some packages, MPN conventions exist for passives), but no canonical "here's what this field means" pedagogy note for beginners.

## Primary sources to consult

- IPC-7351 (Land Pattern Naming Convention) — https://www.ipc.org/
- JEDEC package outline naming
- EDA tool conventions — KiCad symbol library conventions, Altium, OrCAD
- Octopart / Digi-Key / Mouser MPN taxonomy
- Existing vault notes on specific packages (grep first)

## Suggested extraction output

Four atomic notes + one MOC:
- `moc-component-metadata-fields.md` — index of the four field definitions
- `component-family-taxonomy-passive-active-mechanical.md`
- `component-mounting-type-tht-vs-smt-vs-mixed-tradeoffs.md`
- `component-package-type-imperial-0603-vs-metric-1608.md`
- `component-mpn-vs-sku-vs-generic-part-numbering.md`

Audience tiers: beginner (definition) → intermediate (tradeoffs) → expert (supplier-side mechanics).

## Instructions for /extract

1. Grep vault for existing partial coverage — avoid duplication; augment instead.
2. Synthesize four atomic notes + MOC.
3. Cross-link from `moc-eda-fundamentals.md` + each component-specific MOC (passives, microcontrollers, connectors).
4. Run `/vault-quality-gate` + `/vault-audience` (tier check).
5. Mark this stub `extracted` in `ops/queue/gap-stubs.md`.
