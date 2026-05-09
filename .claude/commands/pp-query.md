---
description: Cross-query the active ProtoPulse NotebookLM corpus (all pp:active notebooks). Returns synthesized answer with citations.
argument-hint: <question>
allowed-tools: Bash(nlm:*)
---

# /pp-query

One-shot recall against the full `pp:active` corpus. Use when scope is unclear or spans tiers.

## Args
$ARGUMENTS

## Steps

1. Verify auth: `nlm login --check`. If fails, halt.
2. Run: `nlm cross query --tags pp:active "$ARGUMENTS"`.
3. Print the response verbatim (citations included).
4. Capture and report the conversation-id from the response so Tyler can pass `--conversation-id <id>` on follow-ups.
5. If Tyler wants a follow-up, use `nlm notebook query <alias> "<follow-up>" --conversation-id <id>`.

## Notes
- 1 chat quota.
- For feature-specific scope, query `pp-core` with the feature slug in the prompt.
- For component-specific scope, query `pp-hardware` with the part number in the prompt.
- For methodology, use `nlm notebook query pp-core "Ars Contexta <question>"`.
