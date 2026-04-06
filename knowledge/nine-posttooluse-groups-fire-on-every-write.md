---
description: Every Write/Edit operation triggers 9 PostToolUse matcher groups sequentially, creating a dense blocking pipeline
type: claim
source: ".claude/settings.json"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/settings.json"]
---

# nine PostToolUse groups fire on every write

When Claude writes or edits a file, 9 out of 11 PostToolUse matcher groups fire in sequence: lint-changed, typecheck-changed, check-any-changed, test-changed, check-comment-replacement (Edit only), check-unused-parameters (Edit only), codebase-map-update, context-budget (wildcard matcher), and read-tsc-errors. Only validate-note and auto-commit-vault are Write-only and scoped to vault files.

This means a single TypeScript file edit triggers lint, typecheck, any-check, test-changed, comment-replacement, unused-parameters, codebase-map-update, context-budget, and tsc-error display -- at minimum 9 sequential operations. The typecheck-changed hook alone takes 33-44 seconds on ProtoPulse (mitigated by the 180s claudekit timeout config), so the total pipeline time per edit can be substantial.

The context-budget hook fires on every tool use (wildcard matcher), adding overhead even for Read operations.

---

Relevant Notes:
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the full hook inventory
- [[blocking-typecheck-takes-33-to-44-seconds-on-protopulse]] -- the slowest individual hook

Topics:
- [[dev-infrastructure]]
