---
name: E2E walkthrough — Procurement — meticulous
description: Frontend E2E findings for 'Procurement — meticulous' chunk from 2026-04-18 walkthrough. 11 E2E IDs; 1 🔴, 3 🟡, 4 🟢, 2 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0840-0840
severity_counts:
  p1_bug: 1
  ux: 3
  idea: 4
  works: 2
  e2e_ids: 11
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Procurement — meticulous

URL `/projects/30/procurement`. Render confirmed (correcting initial snapshot-based false positive E2E-006). Top-level tablist with 17 sub-tabs visible: BOM Management (default selected) / BOM Comparison / Alternates / Live Pricing / Assembly Cost / Mfg Validator / Assembly Risk / Assembly Groups / Cost Optimizer / Order History / PCB Tracking / Risk Scorecard / AVL Compliance / Cross-Project / Supply Chain / Templates / My Inventory.

BOM Management default panel: Search, Cost Optimisation toggle, ESD toggle, Assembly toggle, Add Item. Estimated cost $0.00 / unit @ 1k qty. Export CSV. Sortable columns: Status / Part Number / Manufacturer / Description / Supplier / Stock / Qty / Unit Price / Total / Actions. Empty state with Add First Item CTA. Component Parts Reference (1) collapsed pane.

### Baby step: Click "Add First Item"

→ Opens `Add BOM Item` dialog with proper accessibility (`role="dialog"`, description). Fields: Part Number (required), Manufacturer, Supplier (combobox default "Digi-Key"), Description, Quantity (1-999999), Unit Price (0-99999.99). Cancel + Add to BOM + Close buttons.

- **E2E-241 ✅ WORKS** — Add BOM Item dialog renders correctly with proper a11y (dialog role + aria-description).
- **E2E-242 🟡 UX** — Supplier defaults to "Digi-Key". Add toggle to remember user's preferred supplier (or use last-used).
- **E2E-243 🟢 IDEA** — Form fields don't auto-suggest from existing project parts. Adding BME280 to BOM should pre-fill from architecture node.
- **E2E-244 🔴 BUG (test methodology)** — Sequential `fill_form` of 5 fields timed out and produced corrupted state ("oBrME280" — keystrokes interleaved). May indicate a React controlled-input race or the testing tool issue. To re-verify with manual keystrokes.
- **E2E-245 🟢 IDEA** — Description field accepts only ~35 chars before truncation? Need to verify max length.
- **E2E-246 🟢 IDEA** — No validation feedback on Part Number (required) until submit. Could mark required ones with red asterisk.

### Procurement remaining (catalogued)

17 sub-tabs (each with own surface), Compare Suppliers button, Cost Optimisation/ESD/Assembly toggles, Sort buttons (Status/Part Number/Manufacturer/Stock/Qty/Unit Price/Total), Export CSV, Component Parts Reference collapsible.

Moving to Validation tab (already deeply documented but baby-step verify Run DRC).

### Validation baby-step: click "Run DRC Checks"

→ Toast appeared: "Validation Running — Design rule and compliance checks initiated." Issue count 128 → 129 (info filter went from (0) to (1)). **Run DRC works.**

- **E2E-247 ✅ WORKS** — Run DRC Checks button fires + toast notification + new issue logged. Real wiring.
- **E2E-248 🟡 UX** — Toast says "Validation Running" but doesn't show progress or completion notification. Needs "Validation complete: 1 new issue found" follow-up toast.
- **E2E-249 🟡 BUG** — DRC adds 1 info issue but project state hasn't changed (still 1 BME280 node, no connections). What new info issue was added? Unclear — clicking Info (1) filter would show, but the persistent 128 base count is still there.
- **E2E-250 🟢 IDEA** — Each "Toggle [issue type]" button presumably mutes the rule. Click should swap to "Toggled off" state with strikethrough.

---

