---
description: Capture an innovation idea / future-direction sketch to pp-research (tagged as innovation subtype).
argument-hint: <idea>
allowed-tools: Bash(nlm:*), Bash(date:*), Bash(touch:*), AskUserQuestion
---

# /pp-innovate

Free-form innovation note. Lands through `pp-research`, a compatibility alias for the active `pp-core` hub; see `docs/notebooklm.md`.

## Args
$ARGUMENTS

## Steps
1. Auth gate.
2. Title: `$(date -u +%Y-%m-%d) — INNOVATION: <first 60 chars of $ARGUMENTS>`.
3. Preview, AskUserQuestion confirm.
4. `nlm note create pp-research "$ARGUMENTS" --title "<title>"`.
5. `touch ~/.claude/state/pp-nlm/cache-invalidate`.

## Notes
- 0 quota.
- Free-form. No mandatory fields. Speculate explicitly when going beyond sources.
- Alias resolution: `pp-research` is a compatibility alias resolving to `pp-core`; run `nlm alias get pp-research` before write.
