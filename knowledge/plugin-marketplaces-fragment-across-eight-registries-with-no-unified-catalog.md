---
description: The 32 installed plugins come from 8 different marketplaces, each with its own versioning and update cadence, creating maintenance complexity
type: insight
source: "~/.claude/plugins/installed_plugins.json"
confidence: proven
topics: ["[[dev-infrastructure]]", "[[gaps-and-opportunities]]"]
related_components: ["~/.claude/plugins/installed_plugins.json"]
---

# plugin marketplaces fragment across eight registries with no unified catalog

The installed plugins span 8 distinct marketplaces: claude-code-marketplace (8 plugins), claude-plugins-official (9), superpowers-marketplace (2), every-marketplace (2), claude-code-plugins (2), claude-code-plugins-plus (4), superpowers-lab (1), taskmaster (1), and agenticnotetaking (1). Each marketplace has its own git repository, version numbering, and update schedule.

The fragmentation creates three problems:

1. **Update drift**: superpowers@superpowers-marketplace was last updated 2026-02-20. arscontexta@agenticnotetaking shows version 0.8.0. frontend-design@claude-plugins-official has an "unknown" version. There is no single command to check all 32 plugins for available updates across all 8 registries.

2. **Duplicate functionality**: ralph-loop@claude-plugins-official and ralph-wiggum@claude-code-plugins provide nearly identical task loop capabilities. agent-sdk-dev exists in both claude-plugins-official and claude-code-plugins with separate installations. compounding-engineering@every-marketplace and compound-engineering@every-marketplace are different versions of what appears to be the same plugin.

3. **No dependency tracking**: Plugins can depend on each other (superpowers-chrome extends superpowers' browser capabilities), but these dependencies are not declared in the plugin manifest. Uninstalling superpowers would break superpowers-chrome silently.

The `known_marketplaces.json` file tracks marketplace URLs, but there is no health dashboard showing which plugins are active, stale, conflicting, or redundant.

---

Relevant Notes:
- [[thirty-two-plugins-installed-but-fewer-than-twelve-actively-used-in-protopulse]] -- the usage gap
- [[four-overlapping-task-management-systems-fragment-attention]] -- ralph duplication specifically
- [[twelve-deprecated-skills-still-exist-alongside-their-replacements]] -- skill-level duplication from plugins

Topics:
- [[dev-infrastructure]]
- [[gaps-and-opportunities]]
