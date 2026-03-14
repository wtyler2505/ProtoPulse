---
summary: The .arscontexta marker file at project root controls whether knowledge vault hooks (session capture, note validation, auto-commit) run — hooks check for its existence first and exit silently if absent
category: architecture
areas:
  - agent-workflows
  - conventions
---

# Arscontexta vault marker file acts as a feature flag that conditionally activates knowledge system hooks without code changes

Four hooks in `.claude/hooks/` implement a guard pattern where the first action is checking for the `.arscontexta` marker file:

```bash
VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || exit 0
```

This appears in:
- `session-capture.sh` (Stop) — saves session metadata to `knowledge/ops/sessions/`
- `session-orient.sh` (SessionStart) — reports vault state (insight count, capture overflow, pending observations/tensions, due reminders)
- `validate-note.sh` (PostToolUse/Write) — validates YAML frontmatter on insight/capture files
- `auto-commit-vault.sh` (PostToolUse/Write, async) — auto-commits knowledge file changes

The marker file itself contains configuration: `git: true`, `session_capture: true`, `vault_root: knowledge/`. Individual features can be toggled — `session-capture.sh` checks `session_capture: false` and `auto-commit-vault.sh` checks `git: false` before proceeding.

**Design insight:** This pattern makes the knowledge system entirely opt-in per repository. The hooks are registered globally in `settings.json` and fire on every project, but they no-op in repositories without the vault marker. This means the same hook configuration works across multiple projects without contaminating non-vault repositories with knowledge system behavior.

**The orient hook is particularly sophisticated.** It implements condition-based maintenance triggers: warns when captures exceed 20 (overflow), observations exceed 10, or tensions exceed 5. It also checks a reminders file for due items. This transforms a passive system into one that proactively surfaces maintenance needs at session start.

**Auto-commit runs async.** The `auto-commit-vault.sh` hook has `"async": true` in settings.json, meaning it fires without blocking the agent's workflow. Knowledge commits happen in the background with `--no-verify` to avoid triggering other hooks recursively. This is the only async hook in the configuration.

Areas: [[agent-workflows]], [[conventions]]
