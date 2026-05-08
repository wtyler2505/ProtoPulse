---
description: Deep-research a topic into pp-research notebook (web mode by default).
argument-hint: <topic>
allowed-tools: Bash(nlm:*)
---

# /pp-research

Trigger NotebookLM deep-research on a topic, poll until done, confirm before importing.

## Args
$ARGUMENTS

## Steps
1. Auth gate: `nlm login --check`.
2. `nlm research start "$ARGUMENTS" --notebook-id pp-research --mode deep`. Capture task-id from output.
3. Poll: `nlm research status pp-research --max-wait 600`. Print discovered sources.
4. Ask Tyler: "Import all? Specific indices? Cancel?" via AskUserQuestion.
5. On confirm: `nlm research import pp-research <task-id> [--indices N,M]`.
6. `touch ~/.claude/state/pp-nlm/cache-invalidate`.

## Notes
- 1 deep-research quota + variable source count.
- Deep mode: ~5 min, ~40-80 sources. Use `--mode fast` for ~30s, ~10 sources.
- Sources land in pp-research; the bidirectional bridge (Phase 10) extracts atomic claims into knowledge/.
