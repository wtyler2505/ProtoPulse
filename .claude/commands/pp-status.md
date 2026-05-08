---
description: ProtoPulse NotebookLM Notesbook health dashboard — source counts, archive size, today's quota burn, pending recap, cache age.
allowed-tools: Bash(nlm:*), Bash(jq:*), Bash(stat:*), Bash(date:*), Bash(find:*), Bash(du:*), Bash(ls:*), Bash(wc:*)
---

# /pp-status

Read-only dashboard. Zero quota cost.

## Steps

1. **Auth gate:** `nlm login --check` — report status.
2. **Tier-1 source counts** — for each `pp-*` alias, show count from `~/.claude/state/pp-nlm/source-manifest.json`:
   ```bash
   jq -r 'to_entries | .[] | select(.key | startswith("pp-")) | "  \(.key): \(.value | length) sources"' ~/.claude/state/pp-nlm/source-manifest.json
   ```
3. **Notebook count** in the live account: `nlm notebook list --json | jq 'length'`.
4. **Archive size:** `du -sh /home/wtyler/Projects/ProtoPulse/docs/nlm-archive/ 2>/dev/null` and `jq 'length' /home/wtyler/Projects/ProtoPulse/docs/nlm-archive/manifest.json 2>/dev/null` (artifact count).
5. **Pending recap** — show if `~/.claude/state/pp-nlm/pending-recap.md` exists, with last-modified timestamp.
6. **Cache age** — `stat -c '%y' ~/.claude/state/pp-nlm/session-context-cache.md 2>/dev/null` (compare to 4h TTL).
7. **Recent errors** — last 5 lines of `~/.claude/logs/pp-nlm-errors.log` if non-empty.
8. **Phase 2 runner** — last few lines of `~/.claude/logs/pp-nlm-phase2-runner.log` if active.

## Format
Print as a compact dashboard with section headings. End-of-turn: ≤3 sentences summarizing state.

## Notes
- Read-only. Never mutates.
- Quota burn (today's) is tracked via `~/.claude/logs/pp-nlm-archive.log` for Studio creates and is not currently exposed by `nlm` directly — surface counts only when available.
