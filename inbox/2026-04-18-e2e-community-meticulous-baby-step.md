---
name: E2E walkthrough — Community — meticulous baby-step
description: Frontend E2E findings for 'Community — meticulous baby-step' chunk from 2026-04-18 walkthrough. 7 E2E IDs; 2 🔴, 1 🟡, 1 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 2
  ux: 1
  idea: 1
  works: 0
  e2e_ids: 7
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Community — meticulous baby-step

URL `/projects/30/community`. 10 components, 13132 dl, 5 authors. Sub-tabs Browse/Featured/Collections. Filters: All types / Most Popular sort. Cards static text in a11y tree.

### Baby-step: click "USB-C Connector Module" card

→ Card has `cursor:pointer` + onclick handler but click produces NOTHING visible. No dialog, no detail panel, no install/add button appears.

- **E2E-266 🔴 BUG** — Community card onclick is dead. Same pattern as Coach button (E2E-074). User clicks community card to view details / install — nothing happens.
- **E2E-267 🔴 a11y** — Cards have onclick but no role="button". Same systemic issue as Learn (E2E-261), Dashboard (E2E-068).
- **E2E-268 🟡 UX** — License badge shown (MIT/CC0/CC-BY) but not filterable.
- **E2E-269 🟢 IDEA** — No "Submit your component" CTA. Community without contribution path = library only.

---

