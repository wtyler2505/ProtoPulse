---
description: The react-performance-expert agent exists but no skill, command, or workflow references it, making performance profiling an invisible capability
type: need
source: ".claude/agents/react/react-performance-expert.md, skill listings"
confidence: proven
topics: ["[[claude-code-skills]]", "[[gaps-and-opportunities]]"]
related_components: [".claude/agents/react/react-performance-expert.md"]
---

# no skill routes to performance profiling despite agent existing

A react-performance-expert agent is defined in `.claude/agents/react/` with persistent memory, but no skill, slash command, or CLAUDE.md workflow references it. A developer concerned about render performance, bundle size, or component profiling would need to know the agent exists and manually invoke it -- there's no discovery path.

This contrasts with the code-review-expert agent, which has a dedicated `/code-review` slash command that dispatches it. The performance agent has no equivalent entry point.

The gap is significant for ProtoPulse because known performance debt exists: the ProjectProvider monolith causes quadratic render complexity (documented in gaps-and-opportunities), the AI system prompt rebuilds full project state on every request, and the application has 40+ views. A `/perf-check` or `/profile` skill that invokes the react-performance-expert agent on changed components would close this gap.

Note: a `/perf-check` slash command does exist in the global commands list, but it invokes a "Performance Gate" skill focused on budget enforcement before commits -- not component-level profiling. These are different concerns.

---

Relevant Notes:
- [[monolithic-context-causes-quadratic-render-complexity]] -- the known performance debt
- [[thirty-seven-agents-have-no-trigger-patterns]] -- agent discoverability problem

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]
