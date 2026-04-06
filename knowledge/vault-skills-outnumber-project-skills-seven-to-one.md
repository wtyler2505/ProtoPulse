---
description: 20 of 23 skills serve the Ars Contexta knowledge system while only 3 serve ProtoPulse development directly
type: claim
source: ".claude/skills/"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/skills/"]
---

# vault skills outnumber project skills seven to one

Of 23 skills in `.claude/skills/`, 20 are knowledge system operations (extract, connect, revisit, rethink, seed, pipeline, ralph, learn, remember, refactor, validate, verify, graph, stats, tasks, next, resume, ship, fix-audit-failures, visual-audit) and only 3 are ProtoPulse development tools (checklist-update, devserver, status).

This ratio reflects the Ars Contexta philosophy of "heavy processing" -- the knowledge system needs many specialized workflows for extraction, connection, verification, and maintenance. But it also reveals a gap: common development workflows like "run a specific test file," "check API endpoint," "scaffold a new route," or "benchmark a component" have no skill support. Developers rely on raw commands or CLAUDE.md instructions instead of reusable skill abstractions.

The largest skill is extract at 1128 lines, reflecting the complexity of turning raw sources into structured knowledge notes. The smallest is resume at 97 lines, which reconstructs context after session continuation.

---

Relevant Notes:
- [[extract-is-the-largest-skill-at-1128-lines]] -- the extraction pipeline
- [[ship-and-verify-overlap-on-commit-validation-territory]] -- skill boundary confusion

Topics:
- [[dev-infrastructure]]
