---
name: E2E walkthrough — Inventory (Storage) — meticulous baby-step
description: Frontend E2E findings for 'Inventory (Storage) — meticulous baby-step' chunk from 2026-04-18 walkthrough. 4 E2E IDs; 0 🔴, 1 🟡, 2 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 0
  ux: 1
  idea: 2
  works: 0
  e2e_ids: 4
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Inventory (Storage) — meticulous baby-step

URL `/projects/30/storage`. Storage Manager. Scan + Labels. Filter input. Empty state "No BOM items to display." Very thin tab.

- **E2E-276 🟡 UX** — Tab name "Inventory" but URL `/storage` and h-text "Storage Manager". Three names again (cf. E2E-053 Learn).
- **E2E-277 🟢 IDEA** — Empty state should encourage adding BOM items first ("Add BOM in Procurement → Inventory tracks placement here").
- **E2E-278 🟢 IDEA** — Scan and Labels don't say what they scan/label.

---

