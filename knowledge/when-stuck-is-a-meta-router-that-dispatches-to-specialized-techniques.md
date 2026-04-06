---
description: The /when-stuck skill matches stuck-symptoms to problem-solving techniques rather than solving problems directly, acting as the entry point to the reasoning toolbox
type: concept
source: "~/.claude/skills/when-stuck/SKILL.md"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: ["~/.claude/skills/when-stuck/"]
---

# when stuck is a meta router that dispatches to specialized techniques

The /when-stuck skill is architecturally distinct from other skills: it doesn't do work, it routes to the skill that should do work. It maps stuck-symptoms (going in circles, can't figure out the approach, tried everything) to specific techniques (collision-zone, scale-game, inversion, meta-pattern, defense-in-depth, simplification-cascades, preserving-productive-tensions).

It also integrates with the Clear Thought MCP server's tools: `sequentialthinking`, `mentalmodel`, and `debuggingapproach` are listed in its allowed-tools. This means /when-stuck can dispatch to either a skill or an MCP operation depending on the nature of the problem.

The skill explicitly lists situations where it should NOT be used -- when the problem is clear, when you already know which technique to apply, or for simple syntax errors. This self-limiting behavior prevents the meta-routing overhead when direct action would be faster.

The design reflects a deliberate hierarchy: try direct solutions first, invoke /when-stuck only when genuinely stuck, and escalate to /oracle (the strongest agent) only when structured techniques fail. Each escalation level trades speed for depth.

---

Relevant Notes:
- [[five-thinking-skills-provide-structured-reasoning-toolbox]] -- the techniques it dispatches to
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] -- the next escalation level

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
