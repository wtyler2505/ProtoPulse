---
name: E2E walkthrough — Procurement tab — TESTED
description: Frontend E2E findings for 'Procurement tab — TESTED' chunk from 2026-04-18 walkthrough. 5 E2E IDs; 1 🔴, 1 🟡, 3 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0841-0841
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

## Procurement tab — TESTED

Renders: 17 sub-tabs (BOM Management, BOM Comparison, Alternates, Live Pricing, Assembly Cost, Mfg Validator, Assembly Risk, Assembly Groups, Cost Optimizer, Order History, PCB Tracking, Risk Scorecard, AVL Compliance, Cross-Project, Supply Chain, Templates, My Inventory). Default tab BOM Management shows: search, settings/ESD/assembly toggles, Add Item, Estimated cost ($0.00 / unit @ 1k qty), Export CSV, BOM table (Status/Part Number/Manufacturer/Description/Supplier/Stock/Qty/Unit Price/Total/Actions), empty-state "No items in your Bill of Materials", Component Parts Reference (1).

### Procurement findings

- **E2E-006 🔴 a11y** — Procurement panel content is **invisible to a11y tree**. take_snapshot returns only toolbar+tabs+chat panel for this view; entire tabpanel with BOM table not exposed. Screen readers will see an empty page. evaluate_script confirms DOM content exists (87004 bytes innerHTML in main). Likely cause: tabpanel divs have no aria-labelledby and contain custom role-less elements. Same likely affects all 16 other procurement sub-tabs.
- **E2E-007 🟡 UX** — Sub-tab strip (17 tabs) overflows. No scroll affordance visible until you discover it.
- **E2E-008 🟢 IDEA** — Estimated cost shows "$0.00 / unit @ 1k qty" with empty BOM. Should grey out or show "Add items to estimate cost" — current empty number reads as "this part is free."
- **E2E-009 🟢 IDEA** — "Component Parts Reference (1)" panel — what is this counting? Unclear without expand.
- **E2E-010 🟢 IDEA** — `data-testid` attributes are excellent (every interactive element has one — great for E2E tests). Use as basis for Playwright suite.

---

