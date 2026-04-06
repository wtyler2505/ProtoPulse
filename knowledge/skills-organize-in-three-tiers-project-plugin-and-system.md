---
description: The skill system has three layers with different ownership and scope -- 23 project, 142 plugin, and built-in system tools -- totaling 215+ available capabilities
type: concept
source: ".claude/skills/, ~/.claude/skills/, ~/.claude/plugins/installed_plugins.json"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: [".claude/skills/", "~/.claude/skills/"]
---

# skills organize in three tiers project plugin and system

The Claude Code skill ecosystem has three distinct tiers, each with different ownership, update cadence, and scope:

**Tier 1: Project skills (23)** -- Live in `.claude/skills/` within the ProtoPulse repository. These are the most specific: vault processing (seed, extract, connect, revisit, verify, pipeline, ralph, validate, refactor), vault navigation (status, stats, graph, learn, tasks, next, resume), creative (rethink), meta (remember, checklist-update, visual-audit, fix-audit-failures), and spec workflow (spec:create/validate/decompose/execute). Owned by the project, versioned with git, and evolve with ProtoPulse development decisions.

**Tier 2: Plugin skills (~142)** -- Injected by 32 installed plugins. These are general-purpose: superpowers (15 lifecycle skills), arscontexta (10 vault architecture skills), and dozens more from marketplace plugins. Owned by plugin authors, updated via plugin sync. These skills are not project-specific -- they work across any codebase.

**Tier 3: System tools (built-in)** -- Claude Code's native capabilities: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch. These are always available, never fail to load, and form the foundation that skills orchestrate. Owned by Anthropic, updated with Claude Code releases.

The tiers interact hierarchically: project skills call plugin skills (e.g., /pipeline may invoke superpowers verification patterns), and both tiers orchestrate system tools. But the routing problem is real -- with 215+ total skills, the agent must know which tier and which skill applies to the current situation. Without CLAUDE.md routing guidance, the skill most recently mentioned in context tends to win, regardless of whether it is the best fit.

---

Relevant Notes:
- [[thirty-two-plugins-installed-but-fewer-than-twelve-actively-used-in-protopulse]] -- plugin tier bloat
- [[vault-skills-outnumber-project-skills-seven-to-one]] -- project tier composition
- [[nineteen-mastery-skills-are-the-deepest-knowledge-layer]] -- deep skills within the plugin tier

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
