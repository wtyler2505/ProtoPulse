---
name: E2E walkthrough — Breadboard tab — TESTED (already deeply audited per BL plan)
description: Frontend E2E findings for 'Breadboard tab — TESTED (already deeply audited per BL plan)' chunk from 2026-04-18 walkthrough. 5 E2E IDs; 0 🔴, 2 🟡, 3 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_none
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

## Breadboard tab — TESTED (already deeply audited per BL plan)

URL `/projects/30/breadboard`. Massive feature surface. Per BL Wave 1 audit, 14 fixes already landed.

Project parts stats: 1 tracked, 0 owned, 0 placed, 0 bench-ready, 0 low stock, 1 missing, 0 verified, 1 starter-safe.

Major sections: Workbench actions (Create/Expand/Stash/Schematic/Editor/Community/Shop), Quick Intake (scan + qty + storage + submit), Bench AI (6 actions: Resolve part / Explain / Diagnose / Substitutes / Gemini layout / Cleaner layout), Board Health (Audit / Pre-flight), Starter Shelf (MCU/DIP/LED/R/C/D/Switch starters), Component Placer (filters: All/Owned/Ready/Verified/Starter + group by category).

### Breadboard findings (new, beyond BL audit)

- **E2E-035 🟡 UX** — Stats row shows 8 numbers (1/0/0/0/0/1/0/1) with 8 labels — visually busy. Group as "Inventory: 1 tracked / 0 owned" + "Bench: 0 placed / 0 ready" + "Verification: 0 verified / 1 missing".
- **E2E-036 🟡 UX** — "0 LIVE WIRES" indicator with no canvas yet — meaningless until wiring exists.
- **E2E-037 🟢 IDEA** — Quick Intake form at top of breadboard is unusual placement; could collapse and float as FAB.
- **E2E-038 🟢 IDEA** — Bench AI requires API key — no key state shown here. Same disable-with-tooltip pattern needed.
- **E2E-039 🟢 IDEA** — Starter Shelf shows generic "Drop a DIP-style MCU body across the trench" — could include a 30s how-to GIF for first-time users.

### Edge cases
- Drag starter LED with no MCU on board (still allowed?)
- Place 100+ components (perf)
- Audit while components placed but no nets
- Pre-flight when external power module exceeds 700mA budget (per BL-0150)
- Quick Intake duplicate part name
- Two users opening same breadboard, drag conflict

---

