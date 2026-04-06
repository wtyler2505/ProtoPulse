---
description: CLAUDE.md references .claude/skills/settings but that skill directory does not exist -- a stale reference from a removed or renamed skill
type: claim
source: "CLAUDE.md"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: ["CLAUDE.md"]
---

# CLAUDE.md references a settings skill that does not exist

The infra audit detected that CLAUDE.md references `.claude/skills/settings` but no such directory exists under `.claude/skills/`. The 23 existing skills are: checklist-update, connect, devserver, extract, fix-audit-failures, graph, learn, next, pipeline, ralph, refactor, remember, resume, rethink, revisit, seed, ship, stats, status, tasks, validate, verify, visual-audit.

This is likely a remnant from a previous skill that was removed or renamed. Stale references in CLAUDE.md are low-severity but create confusion: Claude may attempt to invoke or describe a skill that does not exist, wasting tokens on error recovery.

The fix is to search CLAUDE.md for the reference and either remove it or update it to point to the correct skill name.

---

Relevant Notes:
- [[combined-claude-md-exceeds-800-lines-creating-context-pressure]] -- CLAUDE.md health
- [[vault-skills-outnumber-project-skills-seven-to-one]] -- the actual skill inventory

Topics:
- [[dev-infrastructure]]
