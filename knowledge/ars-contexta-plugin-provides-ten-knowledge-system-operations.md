---
description: The Ars Contexta plugin provides 10 skills covering knowledge system lifecycle from initial setup through ongoing health monitoring
type: claim
source: "arscontexta plugin system prompt"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]", "[[methodology]]"]
related_components: [".claude/skills/extract/", ".claude/skills/connect/"]
---

# ars contexta plugin provides ten knowledge system operations

The Ars Contexta plugin contributes 10 skill entry points: setup, help, tutorial, add-domain, ask, recommend, architect, upgrade, reseed, and health. These operate at the system-configuration level -- they don't process individual notes (that's the project skills' job), they manage the knowledge system architecture itself.

The critical distinction: project skills like /extract, /connect, and /verify process content within the vault. Ars Contexta plugin skills like /arscontexta:architect and /arscontexta:health manage the vault's structure and configuration. This is a meta-layer -- the plugin that generated the system now monitors its own health.

The `ask` skill routes questions through a 3-tier research knowledge graph, meaning the plugin carries its own internal methodology documentation. The `reseed` skill can re-derive the entire knowledge system from first principles when structural drift accumulates -- a factory reset for the vault architecture.

---

Relevant Notes:
- [[knowledge-pipeline-has-ten-skills-covering-the-full-lifecycle]] -- the content processing pipeline
- [[vault-skills-outnumber-project-skills-seven-to-one]] -- the ratio of vault to dev skills

Topics:
- [[claude-code-skills]]
- [[methodology]]
