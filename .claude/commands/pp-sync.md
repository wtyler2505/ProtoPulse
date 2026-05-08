---
description: Sync stale Drive sources, run nlm doctor, verify auth, print summary.
allowed-tools: Bash(nlm:*)
---

# /pp-sync

Maintenance command. Runs read-only checks first, then prompts before mutating.

## Steps
1. `nlm login --check` — report.
2. `nlm doctor` — report.
3. For each Tier-1 alias: `nlm source stale <alias>`. Collect into a summary.
4. If any stale: AskUserQuestion before `nlm source sync <alias> --confirm` per alias.
5. Print final dashboard.

## Notes
- 0 quota.
- Sync only runs if Tyler approves per-notebook.
