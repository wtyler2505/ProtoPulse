---
description: Claudekit hooks and custom vault hooks both fire on Write/Edit in PostToolUse with no coordination on ordering or conflicts
type: claim
source: ".claude/settings.json"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/settings.json", ".claude/hooks/"]
---

# claudekit and custom hooks share the PostToolUse pipeline

The PostToolUse event mixes claudekit hooks (lint-changed, typecheck-changed, check-any-changed, test-changed, check-comment-replacement, check-unused-parameters, codebase-map-update) with custom hooks (context-budget, read-tsc-errors, validate-note, auto-commit-vault). They execute in array order as defined in settings.json, with all claudekit hooks running before the custom hooks.

This creates two maintenance concerns:

1. **Update fragility**: claudekit is a globally installed npm package. Updating it could change hook behavior, add new checks, or alter exit codes. Custom hooks depend on the file state left by earlier hooks (e.g., read-tsc-errors reads from the tsc-watch log that start-tsc-watch created). If claudekit hooks modify files or fail in unexpected ways, downstream custom hooks see different state.

2. **No conflict detection**: Both systems can theoretically operate on the same files. The claudekit codebase-map-update hook and the custom auto-commit-vault hook both touch git state. If codebase-map-update stages files that auto-commit-vault then commits, the commit could include unintended changes.

Currently the ordering works because claudekit hooks are pure checkers (read-only analysis) and custom hooks do the git mutations. But this is a convention, not an enforced contract.

---

Relevant Notes:
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the full inventory
- [[auto-commit-vault-is-the-only-async-hook]] -- the async commit hook at the end

Topics:
- [[dev-infrastructure]]
