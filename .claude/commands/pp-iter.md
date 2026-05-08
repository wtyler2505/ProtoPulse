---
description: Append a BL-XXXX iteration decision to pp-backlog (4-field structured note).
argument-hint: <decision summary> — references BL-XXXX if applicable
allowed-tools: Bash(nlm:*), Bash(date:*), Bash(touch:*), Bash(echo:*)
---

# /pp-iter

Capture a decision to the iteration log. The log is the historical record of "we tried X, didn't work, chose Y because Z".

## Args
$ARGUMENTS

## Steps

1. Verify auth: `nlm login --check`.
2. Ask Tyler 4 follow-up fields (AskUserQuestion with multiSelect=false, ordered):
   - **Tried** — what was attempted (one paragraph).
   - **Why not** — why it didn't fit.
   - **Chose** — what was chosen instead.
   - **Why** — the reasoning that made it the right call.
3. Construct body using the template:
   ```markdown
   **Tried:** <field 1>
   **Why not:** <field 2>
   **Chose:** <field 3>
   **Why:** <field 4>
   ```
4. Title: `$(date -u +%Y-%m-%d) — <first 60 chars of $ARGUMENTS> [BL-XXXX if mentioned]`.
5. Preview. Ask: "Push? [Yes / Edit / Cancel]".
6. On Yes: `nlm note create pp-backlog "<body>" --title "<title>"`.
7. `touch ~/.claude/state/pp-nlm/cache-invalidate`.

## Notes
- 0 quota cost.
- BL-XXXX IDs come from `docs/MASTER_BACKLOG.md`. Cross-reference them in $ARGUMENTS so the entry is greppable.
