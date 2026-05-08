---
description: Promote a pp-memories note into MEMORY.md as a 150-char index entry.
argument-hint: [note-id-or-search-term]
allowed-tools: Bash(nlm:*), Read, Edit, AskUserQuestion
---

# /pp-promote

Surface a pp-memories insight into the fast-access MEMORY.md index.

## Args
$1 (optional note-id; if missing, list recent and pick)

## Steps
1. Auth gate.
2. If no $1: `nlm note list pp-memories --json` and AskUserQuestion to pick a recent one.
3. Construct a ≤150-char index entry from the note title. Format:
   `- [Note title](memory_<slug>.md) — one-line hook`
4. Show diff preview against MEMORY.md.
5. AskUserQuestion: "Apply? [Yes / Edit / Cancel]".
6. On Yes: append entry to MEMORY.md.

## Notes
- 0 quota.
- Promotion criteria (advisory): inform >5 future sessions, fits 150 chars, not greppable in code.
- nlm note get does NOT exist — Tyler must paste body manually if creating a memory_*.md sub-file alongside.
