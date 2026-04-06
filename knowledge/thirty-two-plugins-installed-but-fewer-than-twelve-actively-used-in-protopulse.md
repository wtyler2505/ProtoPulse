---
description: The plugin registry has 32 entries from 8 marketplaces but ProtoPulse workflows regularly invoke fewer than 12
type: claim
source: "~/.claude/plugins/installed_plugins.json"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: ["~/.claude/plugins/installed_plugins.json"]
---

# thirty-two plugins installed but fewer than twelve actively used in ProtoPulse

The installed_plugins.json registry lists 32 plugins from 8 distinct marketplaces: superpowers-marketplace (2), claude-code-marketplace (8), claude-plugins-official (9), every-marketplace (2), superpowers-lab (1), taskmaster (1), agenticnotetaking (1), claude-code-plugins (2), and claude-code-plugins-plus (4). Two are project-scoped (compounding-engineering for /home/wtyler, compound-engineering for /home/wtyler/thoughtbox); the remaining 30 are user-scoped and load for every project.

The actively used plugins in ProtoPulse development are: superpowers (lifecycle), arscontexta (vault), context7 (docs), code-review, feature-dev, playground, frontend-design, superpowers-chrome (browser), ralph-loop (task processing), and agent-sdk-dev. That is roughly 10 out of 32.

The unused plugins include: lyra (prompt optimization), ultrathink (multi-agent coordination), bug-detective (debugging), double-check (completion verification), discuss (requirements gathering), rapid-prototyper, tool-evaluator, ui-designer, ux-researcher, rust-analyzer-lsp (wrong language), bottleneck-detector, cache-performance-optimizer, chaos-engineering-toolkit, feature-engineering-toolkit, and ralph-wiggum (duplicate of ralph-loop). Each unused plugin contributes skill definitions to the slash command namespace, inflating the available command list with options that never get invoked.

The overhead is not computational (plugins load lazily) but cognitive -- the skill list shown to the agent includes 142 plugin skills, and the unused ones compete for routing attention with the active ones.

---

Relevant Notes:
- [[superpowers-plugin-provides-the-core-development-lifecycle]] -- the most active plugin
- [[ars-contexta-plugin-provides-ten-knowledge-system-operations]] -- second most active
- [[twelve-deprecated-skills-still-exist-alongside-their-replacements]] -- same namespace pollution pattern

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
