---
description: Synthesize and push a session recap to pp-journal. Sub-args manage Stop-hook draft buffer.
argument-hint: [apply|discard|edit]
allowed-tools: Bash(nlm:*), Bash(date:*), Bash(cat:*), Bash(rm:*), Bash(touch:*), Bash(echo:*), Edit, Read
---

# /pp-recap

Modes:
- **No arg**: synthesize a fresh recap from this session's transcript context, preview, confirm, push to `pp-journal`.
- **`apply`**: read pending Stop-hook draft from `~/.claude/state/pp-nlm/pending-recap.md`, enrich, preview, confirm, push, delete pending.
- **`discard`**: delete pending file, log to `~/.claude/logs/pp-nlm-discarded.log`.
- **`edit`**: open the pending file in `$EDITOR`, then proceed as `apply`.

## Args
$1 (one of: apply, discard, edit, or empty)

## Body

### No arg path
1. Verify auth: `nlm login --check`.
2. Synthesize from session transcript context:
   - **Headlines**: 3-7 lines, what landed.
   - **Decisions / Insights worth capturing**: bullet list.
   - **Open threads**: bullet list of next-session candidates.
3. Format: `<YYYY-MM-DD> — <session-tagline>` as title.
4. Preview to Tyler. Ask: "Push? [Yes / Edit / Cancel]".
5. On Yes: `nlm note create pp-journal "<body>" --title "<title>"`.
6. `touch ~/.claude/state/pp-nlm/cache-invalidate`.

### `apply` path
1. Auth gate.
2. Read `~/.claude/state/pp-nlm/pending-recap.md`. If missing, report and halt.
3. Enrich (Claude reads transcript and fills the "What happened" + "Decisions" sections).
4. Preview to Tyler. Ask: "Push? [Yes / Edit / Cancel]".
5. On Yes: `nlm note create pp-journal "<body>" --title "<title-from-draft>"`.
6. Delete the pending file.
7. `touch ~/.claude/state/pp-nlm/cache-invalidate`.

### `discard` path
1. Move pending content to `~/.claude/logs/pp-nlm-discarded.log` (append).
2. `rm ~/.claude/state/pp-nlm/pending-recap.md`.
3. Confirm to Tyler.

### `edit` path
1. `$EDITOR ~/.claude/state/pp-nlm/pending-recap.md` (or warn if `$EDITOR` not set).
2. Then proceed through the `apply` flow.

## Notes
- 0 quota cost.
- The Stop hook (Phase 7) writes the draft. This command pushes/discards/edits it.
