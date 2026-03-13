---
summary: Improving backlog usability requires adding navigation and planning indexes ON TOP of the raw item list — restructuring the canonical inventory destroys traceability
areas: ["[[index]]"]
related insights:
  - "[[backlog-summary-statistics-must-be-updated-atomically-with-individual-item-status-changes-or-the-single-source-of-truth-becomes-untrustworthy]] — summary stats are an additive layer that must stay in sync with the canonical inventory"
  - "[[the-backlog-health-dashboard-surfaces-systemic-risks-before-they-become-technical-debt]] — the health dashboard is another additive layer over the canonical inventory"
  - "[[gap-audits-that-compare-code-surfaces-against-backlog-produce-higher-signal-findings-than-code-only-audits]] — gap audits depend on a stable canonical inventory to compare against"
created: 2026-03-13
---

ProtoPulse's backlog evolution demonstrated that planning views must be lenses over data, not transformations of it. When Codex attempted to improve MASTER_BACKLOG.md by moving items to separate files or restructuring the canonical inventory, traceability broke — items became orphaned or duplicated. The successful approach was adding navigation (Quick Stats, health dashboards, complexity coverage charts) as layers over the unchanged BL-XXXX item list. The principle: the canonical inventory is sacred. Every improvement is additive scaffolding — search indexes, planning views, health monitors — that references the inventory without modifying its structure.

## Topics

- [[index]]
