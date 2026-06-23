---
description: Sync stale Drive sources, run nlm doctor, verify auth, print summary.
allowed-tools: Bash(nlm:*), AskUserQuestion
---
# /pp-sync
Maintenance command. Runs read-only checks first, then prompts before mutating.

## Steps
1. `nlm login --check`   report.
2. `nlm doctor`   report.
3. For each active hub (`pp-core`, `pp-hardware`), resolve `HUB_ID="$(nlm alias get "$hub")"` and run `nlm source stale "$HUB_ID"`. Collect into a summary keyed by hub name.
4. If any stale: AskUserQuestion before `nlm source sync "$HUB_ID" --confirm` per hub.
5. Print final dashboard.

## Notes
- 0 quota.
- Sync only runs if Tyler approves per-notebook.
- Verified with `nlm` 0.6.6: stale-source check is `nlm source stale NOTEBOOK_ID`; sync is `nlm source sync NOTEBOOK_ID --confirm`.
