---
description: The 37 agent definitions sum to 20,525 lines -- a massive context reservoir that is rarely loaded but expensive when it is
type: claim
source: ".claude/agents/"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/agents/"]
---

# agent definitions total twenty thousand lines

The `.claude/agents/` directory contains 37 markdown files totaling 20,525 lines. The top five by size are nodejs-expert (1059), jest-testing-expert (956), cli-expert (847), react-performance-expert (819), and typescript-type-expert (789). Even the smallest (code-search at 105 lines) is substantial.

When an agent is dispatched as a subagent, its full definition is loaded into that agent's context. A single agent dispatch therefore consumes 100-1000+ lines of context budget just for the system prompt. This is generally acceptable because subagents have their own context windows, but it means agent definitions should be optimized for signal-to-noise ratio.

The current definitions appear to be comprehensive reference documents rather than minimal operational prompts. The nodejs-expert at 1059 lines likely contains information that a well-trained model already knows. The value of agent definitions comes from project-specific conventions and patterns, not from restating general knowledge.

---

Relevant Notes:
- [[thirty-seven-agents-have-no-trigger-patterns]] -- no selective loading mechanism
- [[six-agents-cover-technologies-not-in-protopulse-stack]] -- ~4400 lines of never-used agents

Topics:
- [[dev-infrastructure]]
