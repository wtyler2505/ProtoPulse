# NotebookLM Dirty-Tree Triage (2026-05-16)

Scope: classify the currently deleted NotebookLM-related files in the working tree as intentional vs accidental, so commit slicing can stay safe.

## Likely Intentional (Notebook consolidation/migration lane)

- `data/pp-nlm/chat-configs/*`
- `data/pp-nlm/consolidation/*`

Rationale: these are directly tied to active notebook consolidation + chat-config rewiring work.

## Needs Explicit Confirmation Before Commit

- `.claude/scheduled_tasks.lock`
- `data/metrics.json`

Rationale: lock/metrics files are often ephemeral or machine-local artifacts and can be accidental drift.

## Action Plan For Safe Slicing

1. Keep NotebookLM deletions in a dedicated commit (or dedicated branch lane).
2. Exclude `scheduled_tasks.lock` and `data/metrics.json` unless the commit message explicitly says they are intentional.
3. Before commit, run:
   - `git status --short data/pp-nlm .claude/scheduled_tasks.lock data/metrics.json`
4. If uncertain, keep those two non-NotebookLM files out of the commit.
