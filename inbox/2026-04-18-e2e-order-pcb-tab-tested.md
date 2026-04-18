---
name: E2E walkthrough — Order PCB tab — TESTED
description: Frontend E2E findings for 'Order PCB tab — TESTED' chunk from 2026-04-18 walkthrough. 5 E2E IDs; 0 🔴, 2 🟡, 3 🟢, 0 ✅.
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

## Order PCB tab — TESTED

URL `/projects/30/ordering`. 5-step wizard. Order Readiness Confidence + trust receipt up top.

Steps: 1.Board Spec, 2-4 (next/prev), 5.Final. Spec form: width, height, layers, thickness, copper, finish, mask color (9 swatches: green/red/blue/black/white/yellow/purple/matte-black/matte-green), silk, trace, drill, castellated holes, impedance control, via in pad, gold fingers.

### Order PCB findings

- **E2E-063 🟢 IDEA** — 9 mask colors are nice, but missing Matte White, Pink (hot trend), and Multi (some fabs offer split colors).
- **E2E-064 🟡 UX** — Confidence panel says "BOM empty — add components" but the order flow is *about* the PCB not the BOM. They're related but conflating them confuses the user.
- **E2E-065 🟡 UX** — `4 / 5 compatible fabs` shown without naming the 5 fabs. Click should expand list.
- **E2E-066 🟢 IDEA** — No "Save spec as template" so user must re-enter for each project.
- **E2E-067 🟢 IDEA** — Step navigation only Prev/Next — no breadcrumb / jump-to-step.

### Edge cases
- Width=0 or height=0
- Negative thickness
- Layers > supported by chosen fab
- Currency conversion (default USD, no FX option visible)
- Fab API down — graceful degradation?
- Two simultaneous orders for same project






