---
name: E2E walkthrough — Simulation — meticulous baby-step
description: Frontend E2E findings for 'Simulation — meticulous baby-step' chunk from 2026-04-18 walkthrough. 4 E2E IDs; 0 🔴, 2 🟡, 1 🟢, 1 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_none
severity_counts:
  p1_bug: 0
  ux: 2
  idea: 1
  works: 1
  e2e_ids: 4
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Simulation — meticulous baby-step

URL `/projects/30/simulation`. Start Simulation properly **DISABLED** when no components placed. Trust ladder says "SETUP REQUIRED — Need components". Run DC Operating Point also disabled. Sub-collapsibles: ANALYSIS TYPE (4), PARAMETERS, PROBES (Add Probe), CORNER ANALYSIS, RESULTS, IMPORT SPICE NETLIST, RESULT HISTORY, PRESETS (SAVE NEW). Top: Start Simulation / Export SPICE / Share.

- **E2E-251 ✅ EXCELLENT** — Start Simulation correctly disabled when circuit empty. Trust ladder explanation cites exact reason ("Simulation is blocked until the selected circuit has at least one placed component").
- **E2E-252 🟡 UX** — Confidence panel says "Evidence strong" but trust ladder says "SETUP REQUIRED". Two confidence systems give contradictory signal — pick one source-of-truth.
- **E2E-253 🟡 UX** — Start Simulation has `haspopup="menu"` but is disabled — menu trigger that does nothing is confusing. Either show menu items as disabled, or remove `haspopup` until enabled.
- **E2E-254 🟢 IDEA** — Export SPICE button is enabled even with no circuit. Should disable until there's something to export.

(Skipping deep simulation testing — needs real circuit. Moving forward.)

---

