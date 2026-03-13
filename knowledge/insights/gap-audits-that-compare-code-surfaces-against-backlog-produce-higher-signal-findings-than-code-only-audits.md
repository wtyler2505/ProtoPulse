---
summary: Comparing what code exposes against what the backlog tracks catches both "implemented but untracked" and "tracked but not really done" in a single pass
category: convention
areas: ["[[index]]"]
related insights:
  - "[[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] — gap audits retroactively catch the security gaps that CI gates should prevent"
  - "[[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — gap audits discover the feature-exists-but-not-wired problem"
  - "[[backlog-planning-layers-must-be-additive-scaffolding-over-canonical-item-inventory-not-replacements]] — gap audits work because they compare against the canonical inventory"
  - "[[the-backlog-health-dashboard-surfaces-systemic-risks-before-they-become-technical-debt]] — the health dashboard is an automated complement to manual gap audits"
created: 2026-03-13
---

ProtoPulse's Codex gap audit session demonstrated a methodology that produces higher-signal findings than code-only audits: systematically comparing code surfaces (exported functions, route registrations, UI components) against backlog item statuses. This code-vs-backlog comparison discovered 15 missing backlog items and identified 4 items needing reopening in a single pass. Code-only audits find bugs and style violations. Backlog-only audits find planning gaps. Code-vs-backlog audits find the dangerous middle ground: features that exist in code but aren't tracked, and features marked done that aren't actually complete. This dual-lens approach should be a standard audit methodology.

## Topics

- [[index]]
