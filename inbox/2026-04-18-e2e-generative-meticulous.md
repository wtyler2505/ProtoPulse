---
name: E2E walkthrough — Generative — meticulous
description: Frontend E2E findings for 'Generative — meticulous' chunk from 2026-04-18 walkthrough. 2 E2E IDs; 0 🔴, 1 🟡, 1 🟢, 0 ✅.
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

## Generative — meticulous

URL `/projects/30/generative_design`. Circuit Description input. Budget $25 / Max Power 5W / Max Temp 85C defaults. Population + Generations params. Generate button. "No candidates yet".

- **E2E-303 🟡 UX** — Generate button is enabled even with no description AND no API key. Will fail. Disable until both ready.
- **E2E-304 🟢 IDEA** — Genetic algorithm params (Population / Generations) are power-user — hide behind "Advanced" disclosure.

---

