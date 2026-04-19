---
name: E2E walkthrough — Tab Inventory (DYNAMIC — 32 → 35 after first node added)
description: Frontend E2E findings for 'Tab Inventory (DYNAMIC — 32 → 35 after first node added)' chunk from 2026-04-18 walkthrough. 2 E2E IDs; 0 🔴, 1 🟡, 1 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_none
severity_counts:
  p1_bug: 0
  ux: 1
  idea: 1
  works: 0
  e2e_ids: 2
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Tab Inventory (DYNAMIC — 32 → 35 after first node added)

**Initial 32 (empty project):** Dashboard, Architecture, Arduino, Circuit Code, Breadboard, Component Editor, Procurement, Simulation, Tasks, Learn, Vault, Community, Order PCB, Inventory, Serial Monitor, Calculators, Patterns, Starter Circuits, Labs, History, Audit Trail, Lifecycle, Comments, Generative, Digital Twin, Exports, Supply Chain, BOM Templates, My Parts, Alternates, Part Usage.

**Added after first arch node added:** Schematic, PCB, Validation, 3D View. (4 new tabs appear when the project has design data.)

- **E2E-089 🟢 IDEA** — Tab dynamism is good progressive-disclosure UX, but undocumented. Add tooltip on tab strip overflow: "Schematic and PCB unlock when you add components".
- **E2E-090 🟡 UX** — When tabs appear suddenly, the strip horizontal scroll position may shift unexpectedly. Soft-fade-in or anchor to current tab on add.

---

