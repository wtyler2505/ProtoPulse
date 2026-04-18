---
name: E2E walkthrough — Order PCB — meticulous baby-step
description: Frontend E2E findings for 'Order PCB — meticulous baby-step' chunk from 2026-04-18 walkthrough. 7 E2E IDs; 2 🔴, 1 🟡, 2 🟢, 1 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 2
  ux: 1
  idea: 2
  works: 1
  e2e_ids: 7
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Order PCB — meticulous baby-step

URL `/projects/30/ordering`. 5-step wizard (Board Specs / Select Fab / DFM Check / Quotes / Summary). Steps 3-5 properly disabled until prerequisites met. **Excellent gating.** Quantity default 5. Width 100mm × Height 80mm — **THIRD source-of-truth conflict** with PCB (50×40) and 3D View (100×80).

- **E2E-270 🔴 BUG (PATTERN)** — Order PCB Width/Height = 100×80mm matches 3D View (100×80) but NOT PCB tab (50×40). Three different boards in same project: PCB / 3D / Order. Source-of-truth must converge.
- **E2E-271 🔴 BUG (PATTERN)** — All spinbuttons (Quantity, Width, Height, Min Trace, Min Drill) have `valuemax="0"` — broken constraint (E2E-236 pattern again).
- **E2E-272 ✅ EXCELLENT** — Wizard steps disable correctly until prerequisites met. Tooltip-style "Next step: Review the board spec, then choose a compatible fab to unlock DFM preflight."
- **E2E-273 🟢 IDEA** — Special Features checkboxes (Castellated/Impedance/Via-in-Pad/Gold Fingers) — clicking these should warn about cost impact + fab compatibility.
- **E2E-274 🟢 IDEA** — Solder mask color is button-row (9 options) but no checked/active state shown in a11y. Need `aria-pressed`.
- **E2E-275 🟡 UX** — Min Trace 0.2mm and Min Drill 0.3mm defaults are conservative for hobby — could auto-set from chosen fab capabilities.

---

