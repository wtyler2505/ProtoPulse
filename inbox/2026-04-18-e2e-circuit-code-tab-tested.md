---
name: E2E walkthrough — Circuit Code tab — TESTED
description: Frontend E2E findings for 'Circuit Code tab — TESTED' chunk from 2026-04-18 walkthrough. 5 E2E IDs; 1 🔴, 1 🟡, 3 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 1
  ux: 1
  idea: 3
  works: 0
  e2e_ids: 5
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Circuit Code tab — TESTED

URL `/projects/30/circuit_code`. Code DSL editor (left) + schematic preview (right). Pre-populated with `// ProtoPulse Circuit DSL` template (R1 10k → VCC/GND).

Status bar: "1 components, 2 nets, Ready". `APPLY TO PROJECT` button at bottom.

### Circuit Code findings

- **E2E-030 🟡 UX** — DSL has `c.export()` "required — produces the circuit" inline comment. If user deletes that line silently, nothing applies. Editor should detect missing export and warn at compile.
- **E2E-031 🟢 IDEA** — No syntax highlighting visible (?), no autocomplete for `circuit()` API. Should ship monaco/codemirror with type hints from circuit-dsl types.
- **E2E-032 🟢 IDEA** — Schematic preview updates live? Not verified. If not live, add "Preview" button vs always-on diff.
- **E2E-033 🔴 BUG?** — Apply button label is `APPLY TO PROJECT` shouty caps; inconsistent with rest of app's title-case actions.
- **E2E-034 🟢 IDEA** — DSL is a power-user feature; no in-line link to docs/cheat-sheet.

### Edge cases to test
- Apply when DSL throws error
- Apply when component already exists in architecture (merge or replace?)
- Very large DSL (1000+ lines)
- DSL referencing parts not in library
- Round-trip: edit in Architecture, does Code Editor reflect it?

---

