---
name: E2E walkthrough — Tasks (Kanban) tab — TESTED
description: Frontend E2E findings for 'Tasks (Kanban) tab — TESTED' chunk from 2026-04-18 walkthrough. 4 E2E IDs; 0 🔴, 1 🟡, 3 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 0
  ux: 1
  idea: 3
  works: 0
  e2e_ids: 4
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Tasks (Kanban) tab — TESTED

URL `/projects/30/kanban`. 4 columns (Backlog/To Do/In Progress/Done) all empty. Add task per column. Filter by priority.

### Tasks findings

- **E2E-049 🟢 IDEA** — Custom column add ("+ Column") allowed — but default 4 may not match user mental model. Add "Use template: Hardware Sprint / Bug Triage / GTM Launch".
- **E2E-050 🟢 IDEA** — No link from a Task to a BOM item / part / DRC issue. The big win for an EDA tool is "task that auto-resolves when DRC passes" or "task with a part dependency".
- **E2E-051 🟡 UX** — `0 tasks` total at top, `0` per column = redundant noise.
- **E2E-052 🟢 IDEA** — Kanban needs swimlanes by assignee for collaboration to be meaningful.

### Edge cases
- Drag task while another user moves it (CRDT? optimistic conflict?)
- Add task with title >5000 chars
- Delete column with cards in it (cascade?)

---

