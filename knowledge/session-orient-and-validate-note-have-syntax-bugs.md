---
description: Both session-orient.sh and validate-note.sh have bash syntax errors from statements concatenated on single lines
type: claim
source: ".claude/hooks/session-orient.sh, .claude/hooks/validate-note.sh"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/hooks/session-orient.sh", ".claude/hooks/validate-note.sh"]
---

# session-orient and validate-note have syntax bugs

Two custom hook scripts fail `bash -n` syntax checking:

1. **session-orient.sh line 51**: `fiif [[ "$tension_count" -gt 5 ]]; then` -- the `fi` closing the previous `if` block and the next `if` keyword are concatenated on the same line with no whitespace separation. Bash cannot parse `fiif` as two tokens.

2. **validate-note.sh line 50**: A long `grep` pipeline and the next `if` statement are concatenated on one line: `confidence=$(grep ...)      if [[ -n "$confidence" ]]; then`. The shell sees the `if` as part of the command substitution context.

Both bugs appear to be artifacts of editor line-joining or copy-paste without newlines. Since session-orient.sh runs at SessionStart and validate-note.sh runs on every Write to vault files, these errors mean: (a) session orientation may silently fail, losing the tension threshold warning, and (b) confidence validation in knowledge notes may silently skip.

The scripts don't crash the session because they use `set -euo pipefail` and the syntax errors occur after some useful output has already been produced, but the features after the error point are dead code.

---

Relevant Notes:
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- context on when these hooks fire

Topics:
- [[dev-infrastructure]]
