---
description: Debugging escalates from direct fixes through structured skills to thinking tools to the oracle agent, each level increasing reasoning depth and resource cost
type: pattern
source: ".claude/skills/debugging-mastery/, .claude/skills/when-stuck/, .claude/agents/oracle.md"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: [".claude/skills/debugging-mastery/", ".claude/skills/when-stuck/", ".claude/agents/oracle.md"]
---

# the debugging escalation path trades speed for depth across four levels

The debugging toolchain forms an escalation hierarchy where each level is more powerful but more expensive:

**Level 1: Direct debugging** -- The agent reads error messages, checks stack traces, and applies obvious fixes. No skill invocation needed. Handles 70% of issues (typos, missing imports, wrong types). Cost: minimal context.

**Level 2: /debugging-mastery** -- Four-phase structured methodology: hypothesis formation, evidence gathering, root cause isolation, and fix verification. The skill enforces discipline: "find root causes, not symptoms." Handles complex bugs where the error message is misleading. Cost: structured thinking overhead.

**Level 3: /when-stuck meta-router** -- Dispatches to specialized thinking techniques based on how the agent is stuck. Five options: collision-zone-thinking (force unrelated concepts together), scale-game (test at 1000x extremes), inversion-exercise (flip assumptions), meta-pattern-recognition (spot patterns across domains), and simplification-cascades (find one insight that eliminates multiple components). These are creativity tools for when logic alone fails. Cost: significant context for creative exploration.

**Level 4: Oracle agent** -- Persistent memory across sessions, effort:high reasoning, 50 max turns, multi-model fallback chain (GPT-5 -> codex -> self). The nuclear option. Handles bugs that span sessions, require historical context, or benefit from a fundamentally different reasoning approach. Cost: highest (full agent spawn, potential external model call, large context).

The key insight is that MOST problems should be solved at Level 1 or 2. Reaching for Level 4 on a simple type error wastes resources. The escalation path exists precisely to prevent premature oracle invocation.

---

Relevant Notes:
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] -- Level 4 details
- [[when-stuck-is-a-meta-router-that-dispatches-to-specialized-techniques]] -- Level 3 details
- [[five-thinking-skills-provide-structured-reasoning-toolbox]] -- the thinking tools

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
