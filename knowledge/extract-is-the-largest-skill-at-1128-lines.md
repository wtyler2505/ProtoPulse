---
description: The /extract skill is 1128 lines -- the largest skill by far, reflecting the complexity of the knowledge extraction pipeline
type: claim
source: ".claude/skills/extract/SKILL.md"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/skills/extract/SKILL.md"]
---

# extract is the largest skill at 1128 lines

The `/extract` skill at 1128 lines is nearly twice the size of the next largest skills (connect at 746, rethink at 657, revisit at 656). It handles the core knowledge extraction pipeline: taking raw source material and producing structured knowledge notes with proper frontmatter, wiki-links, topic map membership, and provenance tracking.

The skill's size reflects its responsibility: it must understand 8 extraction categories (claims, architecture-decisions, domain-knowledge, competitive-insights, ux-patterns, technical-debt, implementation-patterns, user-needs), enforce schema compliance, decide what to extract vs skip, and optionally chain to `/connect` for automatic relationship discovery.

The config sets a skip rate target of below 10% for domain-relevant sources -- meaning the skill must be comprehensive rather than selective. This "extract everything" philosophy is why the skill is so large: it needs rules for every extraction category and edge case.

---

Relevant Notes:
- [[vault-skills-outnumber-project-skills-seven-to-one]] -- the skill landscape
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- validate-note.sh checks extract output

Topics:
- [[dev-infrastructure]]
