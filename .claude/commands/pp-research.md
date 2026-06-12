---
description: Deep-research a topic into pp-research notebook (web mode by default).
argument-hint: <topic>
allowed-tools: Bash(nlm:*), Bash(touch:*), AskUserQuestion
---

# /pp-research

Trigger NotebookLM deep-research on a topic, poll until done, confirm before importing.

## Args
$ARGUMENTS

## Steps
1. Auth gate: `nlm login --check`.
2. Resolve the target notebook: `NOTEBOOK_ID="$(nlm alias get pp-research)"`; halt if it does not return an ID.
3. `nlm research start "$ARGUMENTS" --notebook-id "$NOTEBOOK_ID" --mode deep`. Capture task-id from output.
4. Poll: `nlm research status "$NOTEBOOK_ID" --max-wait 600`. Print discovered sources.
5. Ask Tyler: "Import all? Specific indices? Cancel?" via AskUserQuestion.
6. On confirm: `nlm research import "$NOTEBOOK_ID" <task-id> [--indices N,M]`.
7. `touch ~/.claude/state/pp-nlm/cache-invalidate`.

## Notes
- 1 deep-research quota + variable source count.
- Deep mode: ~5 min, ~40-80 sources. Use `--mode fast` for ~30s, ~10 sources.
- Sources land in `pp-core` through the `pp-research` compatibility alias; the bidirectional bridge routes extracted claims through `inbox/` per `docs/notebooklm.md`.
- Alias resolution: `pp-research` is a compatibility alias resolving to `pp-core`; run `nlm alias get pp-research` before write.
