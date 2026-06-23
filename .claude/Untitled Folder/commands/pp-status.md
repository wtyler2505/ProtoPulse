---
description: ProtoPulse NotebookLM consolidated hub health dashboard.
allowed-tools: Bash(bash:*), Bash(nlm:*), Bash(jq:*), Bash(timeout:*), Bash(stat:*), Bash(date:*), Bash(find:*), Bash(du:*), Bash(ls:*), Bash(wc:*)
---

# /pp-status

Read-only dashboard. Zero quota cost.

## Steps

1. **Run bounded health:** `bash scripts/pp-nlm/health.sh` — this handles auth with timeouts, live aliases, local manifests, retired tags, archive size, and recent errors.
2. **Hub source counts** — show counts for canonical `pp-core` and `pp-hardware` from `~/.claude/state/pp-nlm/source-manifest.json`:
   ```bash
   jq -r 'to_entries | .[] | select(.key | startswith("pp-")) | "  \(.key): \(.value | length) sources"' ~/.claude/state/pp-nlm/source-manifest.json
   ```
3. **Notebook count** in the live account, if fast enough: `timeout 45s nlm notebook list --json | jq 'length'`.
4. **Archive size:** `du -sh /home/wtyler/Projects/ProtoPulse/docs/nlm-archive/ 2>/dev/null` and `jq 'length' /home/wtyler/Projects/ProtoPulse/docs/nlm-archive/manifest.json 2>/dev/null` (artifact count).
5. **Pending recap** — show if `~/.claude/state/pp-nlm/pending-recap.md` exists, with last-modified timestamp.
6. **Cache age** — `stat -c '%y' ~/.claude/state/pp-nlm/session-context-cache.md 2>/dev/null` (compare to 4h TTL).
7. **Recent errors** — last 5 lines of `~/.claude/logs/pp-nlm-errors.log` if non-empty.
8. **Consolidation runners** — last few lines of `~/.claude/logs/pp-nlm-*.log`, especially pack migration and write-helper errors.

## Format
Print as a compact dashboard with section headings. End-of-turn: ≤3 sentences summarizing state.

## Notes
- Read-only. Never mutates.
- Treat `pp-codebase`, `pp-backlog`, `pp-journal`, `pp-research`, and related aliases as compatibility routes to `pp-core`; treat `pp-breadboard`, `pp-bench`, `pp-feat-parts-catalog`, and `pp-cmp-*` as compatibility routes to `pp-hardware`.
- Quota burn (today's) is tracked via `~/.claude/logs/pp-nlm-archive.log` for Studio creates and is not currently exposed by `nlm` directly — surface counts only when available.
