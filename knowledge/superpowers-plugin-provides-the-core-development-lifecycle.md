---
description: The superpowers plugin maps brainstorm-plan-execute-test-review-ship into dedicated skills with explicit ordering constraints
type: claim
source: ".claude/skills/ and superpowers plugin system prompt"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: [".claude/skills/brainstorming/", ".claude/skills/writing-plans/", ".claude/skills/executing-plans/"]
---

# superpowers plugin provides the core development lifecycle

The superpowers plugin contributes 15 skills that form the backbone of ProtoPulse's development workflow: brainstorming, writing-plans, executing-plans, test-driven-development, requesting-code-review, receiving-code-review, verification-before-completion, subagent-driven-development, systematic-debugging, dispatching-parallel-agents, finishing-a-development-branch, writing-skills, using-git-worktrees, using-superpowers, and browsing.

These skills encode a specific lifecycle: creative divergence (brainstorm) -> structured planning (write-plan) -> disciplined execution (execute-plan) -> quality assurance (TDD + verification) -> peer review (requesting + receiving code review) -> integration (finishing-branch + ship). The `using-superpowers` skill is a meta-skill that fires at session start, establishing the routing conventions for the entire session.

The plugin also provides its own deprecated wrapper commands (superpowers:write-plan, superpowers:brainstorm, etc.) that redirect to the canonical skill names. These wrappers exist for backward compatibility but add cognitive overhead because users see both forms in the command list.

---

Relevant Notes:
- [[writing-plans-must-precede-executing-plans-as-contract]] -- the plan-then-execute constraint
- [[three-separate-code-review-paths-create-routing-confusion]] -- review workflow fragmentation

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
