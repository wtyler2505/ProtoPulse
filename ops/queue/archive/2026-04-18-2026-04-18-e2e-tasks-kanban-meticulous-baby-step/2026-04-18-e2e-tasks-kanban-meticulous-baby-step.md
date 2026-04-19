---
name: E2E walkthrough — Tasks (Kanban) — meticulous baby-step
description: Frontend E2E findings for 'Tasks (Kanban) — meticulous baby-step' chunk from 2026-04-18 walkthrough. 6 E2E IDs; 0 🔴, 2 🟡, 2 🟢, 2 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_none
severity_counts:
  p1_bug: 0
  ux: 2
  idea: 2
  works: 2
  e2e_ids: 6
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Tasks (Kanban) — meticulous baby-step

URL `/projects/30/kanban`. 4 default columns. Click `Add task` → opens Create Task dialog: Title (required), Description (multiline), Column (Backlog default), Priority (Medium default), Tags (comma-separated), Assignee, Due date (Month/Day/Year spin + Show date picker menu). Created button disabled until Title filled.

### Baby-step: create + move task

→ Created "E2E Test Task" successfully. Backlog count 0 → 1. Card shows Title + Priority badge + Move left/right (left disabled in Backlog, right enabled), Edit, Delete.
→ Click Move task right → moved to "To Do" column (Backlog 0, To Do 1, both move buttons enabled).

- **E2E-255 ✅ WORKS** — Task creation flow is solid: dialog opens, validates required Title, creates, card renders.
- **E2E-256 ✅ WORKS** — Move task right increments column. Move left now enabled.
- **E2E-257 🟡 UX** — Date picker spinbuttons have value=0 / valuemin=1 — invalid initial state. Should either start as today's date or empty visual state.
- **E2E-258 🟢 IDEA** — Move task right/left as separate buttons is screen-reader-friendly but verbose. Add drag-and-drop too (catalogued — not tested via DevTools).
- **E2E-259 🟢 IDEA** — No way to link Task to a BOM item, DRC issue, or design milestone. This is the killer integration the Tasks panel needs to be more than a generic kanban.
- **E2E-260 🟡 UX** — Priority "Medium" badge with no color coding — should be color-tagged (Red=critical, Amber=high, Yellow=med, Gray=low).

---

