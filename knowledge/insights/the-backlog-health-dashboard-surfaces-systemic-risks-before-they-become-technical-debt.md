---
summary: A meta-operational table tracking duplicate risk, blocked items, epic decomposition need, and stats freshness catches governance problems early
areas: ["[[index]]"]
related insights:
  - "[[backlog-summary-statistics-must-be-updated-atomically-with-individual-item-status-changes-or-the-single-source-of-truth-becomes-untrustworthy]] — stats freshness is one of the health metrics the dashboard should track"
  - "[[backlog-planning-layers-must-be-additive-scaffolding-over-canonical-item-inventory-not-replacements]] — the health dashboard is an additive monitoring layer"
  - "[[gap-audits-that-compare-code-surfaces-against-backlog-produce-higher-signal-findings-than-code-only-audits]] — gap audits are a manual complement to the automated health dashboard"
created: 2026-03-13
---

ProtoPulse's backlog includes a health dashboard that monitors itself: duplicate risk across items, number of blocked items without resolution paths, items needing epic decomposition, acceptance metadata gaps, and staleness of summary statistics. This is a governance pattern that prevents the backlog itself from becoming technical debt — catching meta-problems before they compound.

## Topics

- [[index]]
