---
description: Project CLAUDE.md (488 lines) plus global CLAUDE.md (399 lines) totals 887 lines loaded every session, consuming ~8600 tokens
type: claim
source: "CLAUDE.md, ~/.claude/CLAUDE.md"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: ["CLAUDE.md"]
---

# combined CLAUDE.md exceeds 800 lines creating context pressure

Every ProtoPulse session loads two CLAUDE.md files: the project-level file (488 lines, ~3960 words, ~5280 tokens) and the global user file (399 lines, ~2487 words, ~3316 tokens). Combined, that is 887 lines and approximately 8,596 tokens consumed before the agent processes a single user message.

With a ~200K token context window, this represents roughly 4.3% of the budget. But because CLAUDE.md content persists through the entire session (never evicted during compaction), it effectively reduces the working context for the agent's entire lifetime. As sessions grow long and context pressure mounts, these 887 lines become a proportionally larger burden.

The two files have possible section overlaps detected by the infra audit: "Code Style" vs global "Code" sections, "Agent Mindset" vs global "Agent" sections. Deduplication or consolidation could reduce the combined size without losing information.

The project CLAUDE.md also references `.claude/skills/settings` which does not exist -- a stale reference from a removed skill that adds noise.

---

Relevant Notes:
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- hooks add further context overhead
- [[claude-md-references-a-settings-skill-that-does-not-exist]] -- stale reference in CLAUDE.md

Topics:
- [[dev-infrastructure]]
