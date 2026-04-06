---
description: 12 deprecated skills remain in the global skills directory consuming listing space and creating confusion about which version to use
type: debt-note
source: "~/.claude/skills/ SKILL.md headers"
confidence: proven
topics: ["[[claude-code-skills]]", "[[gaps-and-opportunities]]"]
related_components: ["~/.claude/skills/"]
---

# twelve deprecated skills still exist alongside their replacements

Scanning SKILL.md headers reveals 12 skills explicitly marked as deprecated: claude-code-hooks, claude-code-hooks-mastery, complete-testing, no-shortcuts-debugging, root-cause-tracing, systematic-debugging, tdd-workflow, test-driven-development, testing-anti-patterns, thorough-verification, verification-before-completion, and writing-skills.

Each deprecated skill names its replacement (e.g., "consolidated into debugging-mastery", "use testing-mastery instead"), but the old skills still appear in skill listings, slash command autocomplete, and the system prompt's available skill list. This means:

1. Claude sees 142 global skills when only ~130 are active, inflating the perceived skill count.
2. Users typing partial names may accidentally invoke deprecated skills (e.g., `/systematic-debugging` instead of `/debugging-mastery`).
3. The deprecated skills still consume context when listed in system prompts.

The fix is straightforward -- move deprecated skills to `~/.claude/skills/.archive/` (which already exists with 16 archived items). They'd remain accessible if needed but would stop appearing in active listings.

---

Relevant Notes:
- [[nineteen-mastery-skills-are-the-deepest-knowledge-layer]] -- mastery skills absorbed the deprecated ones
- [[combined-claude-md-exceeds-800-lines-creating-context-pressure]] -- context budget implications

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]
