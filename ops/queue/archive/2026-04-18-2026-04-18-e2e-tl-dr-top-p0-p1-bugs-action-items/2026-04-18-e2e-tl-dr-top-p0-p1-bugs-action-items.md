---
name: E2E walkthrough — TL;DR — Top P0/P1 Bugs (action items)
description: Frontend E2E findings for 'TL;DR — Top P0/P1 Bugs (action items)' chunk from 2026-04-18 walkthrough. 12 E2E IDs; 10 🔴, 1 🟡, 0 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0843-0852
severity_counts:
  p1_bug: 10
  ux: 1
  idea: 0
  works: 0
  e2e_ids: 12
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## TL;DR — Top P0/P1 Bugs (action items)

| # | Severity | Tab/Area | Bug | Fix |
|---|---|---|---|---|
| E2E-298 | 🔴 P0 | Audit Trail | Leaks audit entries from OTHER projects (OmniTrek Nexus shown on Blink LED tab) | Add project_id filter in `/api/audit/*` query |
| E2E-312 | 🔴 P0 | Alternates | "Failed to load" — 401 on `/api/parts/browse/alternates` | Add `/api/parts/browse/` to `PUBLIC_API_PATHS` (server/request-routing.ts) OR scope auth |
| E2E-313 | 🔴 P0 | Part Usage | "Failed to load" — 401 on `/api/parts/browse/usage` | Same fix as E2E-312 |
| E2E-091/093 | 🔴 P0 | Validation/Dashboard | Validation reports 128 issues on a 1-component project; Dashboard simultaneously says "All Checks Passing" | Two distinct bugs: (a) DRC false positives at empty-design state, (b) reconcile dashboard summary with validation engine |
| E2E-074 | 🔴 P1 | Workspace toolbar | Coach & Help button popover renders nothing (TutorialMenu Suspense fallback or empty?) | Investigate `client/src/pages/workspace/WorkspaceHeader.tsx:431` + `TutorialMenu` lazy chunk |
| E2E-078 | 🔴 P1 | Architecture | `tool-analyze` button is dead | Wire up Analyze tool handler |
| E2E-228/235/270 | 🔴 P1 | PCB/3D View/Order PCB | THREE different default board sizes for same project (50×40 / 100×80 / 100×80) | Single source-of-truth for board geometry |
| E2E-236/271/284 | 🔴 P1 | 3D View/Order PCB/Calculators | Spinbutton constraints `valuemax=0` system-wide — can't increment | Audit all spinbutton wiring; valid range needed |
| E2E-233 | 🔴 P1 | PCB | Layer visibility panel doesn't show inner layers when 4+ layer preset selected | Sync visibility panel with stack layer count |
| E2E-266 | 🔴 P1 | Community | Card click is dead — no detail / install / add | Wire onclick to detail dialog or `/api/community/component/:id` route |
| E2E-068/261/267 | 🟡 a11y | Multiple | `role="button"` on divs without keyboard handler — Dashboard, Learn, Community, Patterns | Use real `<button>`/`<a>` (systemic) |

