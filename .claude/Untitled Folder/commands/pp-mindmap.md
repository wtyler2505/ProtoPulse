---
description: Generate a mind map for a notebook. Auto-archives to docs/nlm-archive/.
argument-hint: [alias=pp-core] [--title "Topic"]
allowed-tools: Bash(nlm:*), Bash(bash:*)
---

# /pp-mindmap

## Args
$ARGUMENTS (defaults: alias=pp-core)

## Steps
1. Auth gate.
2. Parse args. Validate alias resolves: `nlm alias get <alias>`.
3. `nlm mindmap create <alias> --title "<title>" --confirm`. Capture artifact-id.
4. Poll `nlm studio status <alias>` until completed.
5. Trigger archive: `bash .claude/hooks/pp-nlm-studio-archive.sh <alias> <artifact-id>`.

## Notes
- 1 mindmap quota.
- Type-drift caveat: NotebookLM occasionally surfaces `mind_map` requests as `flashcards` in studio_status. Verify type via `nlm studio status --json` before claiming success.
