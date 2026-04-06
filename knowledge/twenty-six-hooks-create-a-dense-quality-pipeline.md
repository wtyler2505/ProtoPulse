---
description: The hook system fires 26 hooks across 6 lifecycle events, creating a comprehensive but heavy quality enforcement layer
type: claim
source: ".claude/settings.json"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/settings.json", ".claude/hooks/"]
---

# twenty-six hooks create a dense quality pipeline

ProtoPulse configures 26 hooks in `.claude/settings.json` across 6 lifecycle events: PreToolUse (3 groups), PostToolUse (11 groups), Stop (2 groups), SubagentStop (empty), SessionStart (2 groups), and UserPromptSubmit (1 group). Of these, 15 are claudekit managed hooks and 11 are custom shell scripts in `.claude/hooks/`.

The density means every file write triggers up to 9 PostToolUse hooks sequentially (lint-changed, typecheck-changed, check-any-changed, test-changed, check-comment-replacement, check-unused-parameters, codebase-map-update, context-budget, read-tsc-errors). This is thorough but creates measurable latency between edits. The Stop event is particularly heavy with 7 blocking hooks that must all pass before the agent can terminate.

The split between claudekit (community package) and custom (project-specific) hooks creates a maintenance surface -- claudekit updates could break expectations, and the two systems have no coordination on execution order.

---

Relevant Notes:
- [[nine-posttooluse-groups-fire-on-every-write]] -- the specific pipeline on Write
- [[auto-commit-vault-is-the-only-async-hook]] -- blocking vs async balance
- [[claudekit-and-custom-hooks-share-the-posttooluse-pipeline]] -- ordering risks

Topics:
- [[dev-infrastructure]]
