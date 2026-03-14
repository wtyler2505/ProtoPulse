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

**Design insight:** This pattern makes the knowledge system entirely opt-in per repository. The hooks are registered globally in `settings.json` and fire on every project, but they no-op in repositories without the vault marker. This means the same hook configuration works across multiple projects without contaminating non-vault repositories with knowledge system behavior. This is a complementary gating mechanism to the [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff|three-layer hook architecture]] — where those layers gate by lifecycle phase, the vault marker gates by repository identity.

**The orient hook is particularly sophisticated.** It implements condition-based maintenance triggers: warns when captures exceed 20 (overflow), observations exceed 10, or tensions exceed 5. It also checks a reminders file for due items. This transforms a passive system into one that proactively surfaces maintenance needs at session start.

**Auto-commit runs async.** The `auto-commit-vault.sh` hook has `"async": true` in settings.json, meaning it fires without blocking the agent's workflow. Knowledge commits happen in the background with `--no-verify` to avoid triggering other hooks recursively. This is the only async hook in the configuration.

The vault marker must be present at session start for `session-orient.sh` to report vault health — this depends on the [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures|SessionStart dependency check]] running first, as `session-orient.sh` also needs `jq` for parsing the marker file's YAML config. The [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer|Ars Contexta skill pipeline]] operates on the vault contents these hooks manage — the marker controls hook activation while the skills control content processing.

---

Related:
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — vault-gated hooks are embedded within the three-layer hook architecture
- [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer]] — the skill pipeline processes the content these hooks manage
- [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures]] — verifies jq (needed by session-orient.sh for vault marker parsing)
- [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent]] — agents can disable vault-related hooks via disableHooks, overriding the marker

Areas: [[agent-workflows]], [[conventions]]
