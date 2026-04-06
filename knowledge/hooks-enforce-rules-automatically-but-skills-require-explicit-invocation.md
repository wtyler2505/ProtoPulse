---
description: The enforcement gap between automatic hooks and manual skills is where workflow discipline breaks down -- hooks catch syntax but not process
type: insight
source: ".claude/settings.json, .claude/skills/"
confidence: proven
topics: ["[[dev-infrastructure]]", "[[gaps-and-opportunities]]"]
related_components: [".claude/settings.json", ".claude/skills/"]
---

# hooks enforce rules automatically but skills require explicit invocation

Hooks and skills serve the same goal (quality enforcement) through opposite mechanisms. Hooks are reactive triggers: they fire on lifecycle events (Write, Edit, Stop, SessionStart) regardless of whether the agent wants them. Skills are proactive recipes: they execute only when the agent deliberately invokes them via the Skill tool or a slash command.

The consequence is a two-tier quality system:

**Automatically enforced (hooks)**: TypeScript errors are caught by typecheck-changed. Lint violations are caught by lint-changed. Unused parameters are caught by check-unused-parameters. Test regressions are caught by test-changed. These NEVER slip through because they fire on every file modification. The 26 hooks create a baseline quality floor.

**Manually enforced (skills)**: Brainstorming before implementation depends on the agent invoking /brainstorming. Planning before execution depends on /writing-plans being called. Verification before completion depends on /verification-mastery. Code review depends on /requesting-code-review. Knowledge capture depends on /extract. These slip through whenever the agent does not invoke the skill, which happens regularly under time pressure or when context compaction drops the routing guidance.

The gap is workflow-level discipline. Hooks catch WHETHER the code is correct (types, lint, tests). Skills enforce HOW the code was produced (brainstormed, planned, tested with TDD, reviewed, verified). A developer can produce code that passes all hook checks but was implemented without a plan, without TDD, without review, and without verification -- and the hook system would not flag it.

Closing this gap would require either: (a) converting workflow skills into hooks (e.g., a PreToolUse hook that requires a plan artifact before implementation), or (b) a meta-layer that tracks skill invocation history and flags missing steps before Stop.

---

Relevant Notes:
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the automatic layer
- [[the-skill-system-has-no-automatic-routing-the-agent-must-know-which-skill-to-invoke]] -- the manual layer
- [[the-full-quality-pipeline-is-brainstorm-plan-execute-test-review-verify-ship]] -- the workflow that skills enforce

Topics:
- [[dev-infrastructure]]
- [[gaps-and-opportunities]]
