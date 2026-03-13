---
summary: Backlog Quick Stats must be updated in the same commit as individual item status changes — stale summary numbers erode trust in the single source of truth
areas: ["[[index]]"]
related insights:
  - "[[backlog-planning-layers-must-be-additive-scaffolding-over-canonical-item-inventory-not-replacements]] — Quick Stats are an additive layer that must stay synchronized with the inventory"
  - "[[definition-of-done-must-include-cross-tool-link-verification]] — both enforce atomic completeness: partial updates erode trust in the system"
  - "[[the-backlog-health-dashboard-surfaces-systemic-risks-before-they-become-technical-debt]] — the health dashboard should detect Quick Stats staleness automatically"
created: 2026-03-13
---

ProtoPulse's `docs/MASTER_BACKLOG.md` serves as the single source of truth for all 508 tracked items. It has a Quick Stats section at the top summarizing counts by priority and status. When agents update individual items (marking P1s done, adding new P2s) without updating the Quick Stats, the summary drifts from reality. After several waves of drift, Tyler can no longer trust the top-level numbers, defeating the purpose of a single source of truth. The rule: every commit that changes item statuses must also update Quick Stats. Atomic or not at all.

## Topics

- [[index]]
