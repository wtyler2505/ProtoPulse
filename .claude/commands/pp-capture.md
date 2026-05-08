---
description: Capture a session insight to ProtoPulse Memories notebook (pp-memories).
argument-hint: <insight text>
allowed-tools: Bash(nlm:*), Bash(date:*), Bash(touch:*), Bash(echo:*)
---

# /pp-capture

Capture an insight to the long-term `pp-memories` corpus. Preview + confirm before mutating.

## Args
$ARGUMENTS

## Steps

1. Verify auth silently: `nlm login --check`. If fails, halt with "Run `nlm login`".
2. Construct title: `$(date -u +%Y-%m-%d) — <first 60 chars of $ARGUMENTS>`.
3. Show preview to Tyler:
   ```
   Title: <constructed-title>
   Notebook: pp-memories
   Body:
   $ARGUMENTS
   ```
4. Ask Tyler: "Capture? [Yes (Recommended) / Edit / Cancel]"
5. On **Yes**: `nlm note create pp-memories "$ARGUMENTS" --title "<title>"`. Print returned note-id.
6. `touch ~/.claude/state/pp-nlm/cache-invalidate` so next SessionStart re-fetches.
7. End-of-turn: ≤2 sentences (title + note-id).

## Notes
- 0 quota cost (note creation is free).
- Note: `nlm note get` doesn't exist — content is write-only via this command. Read access via `nlm cross query --tags pp:active` or `nlm notebook query pp-memories ...`.
