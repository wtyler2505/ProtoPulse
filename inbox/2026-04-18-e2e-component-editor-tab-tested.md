---
name: E2E walkthrough — Component Editor tab — TESTED
description: Frontend E2E findings for 'Component Editor tab — TESTED' chunk from 2026-04-18 walkthrough. 5 E2E IDs; 0 🔴, 2 🟡, 3 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 0
  ux: 2
  idea: 3
  works: 0
  e2e_ids: 5
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Component Editor tab — TESTED

URL `/projects/30/component_editor`. Six sub-tabs: Breadboard / Schematic / PCB / Metadata / Pin Table / SPICE.

Pre-loaded with ATtiny85 (only project part).

Toolbar (huge): Generate / Exact Draft / AI Modify / Datasheet / Pins / Validate / Export / Publish / Library / Import / Import SVG / DRC / History / Save / Undo / Redo.

Trust strip: "Candidate exact part — ic-package — Community-only — 0 evidence sources — Authoritative wiring unlocked".

### Component Editor findings

- **E2E-040 🟡 UX** — 16 toolbar buttons with no grouping — overwhelming. Organize as `[Save | Undo Redo] [AI: Generate / Modify] [Import: SVG / FZPZ / Datasheet] [Validate / DRC / History] [Export / Publish / Library]`.
- **E2E-041 🟢 IDEA** — Trust strip shows "0 evidence sources" — clicking should jump to source-add UI; currently looks static.
- **E2E-042 🟢 IDEA** — "Authoritative wiring unlocked" text + "This part does not require exact-part verification" — contradicts the "Community-only" badge. Reword.
- **E2E-043 🟡 UX** — Mounting Type select defaults to "THT" but ATtiny85 is also commonly SOIC SMD. Should infer from part metadata.
- **E2E-044 🟢 IDEA** — Tags input is empty for ATtiny85 — pre-suggest from family (microcontroller, AVR, 8-bit, dip-8).

### Edge cases
- Edit a part used in multiple projects (warn before save?)
- Import malformed FZPZ
- Import SVG with embedded scripts (XSS check — DOMPurify should catch)
- Generate AI part with no API key
- Pin Table reorder while wires reference pins
- SPICE model with missing values

---

