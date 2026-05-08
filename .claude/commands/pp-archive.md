---
description: Manual force-download of a Studio artifact to docs/nlm-archive/. Use if auto-download missed one.
argument-hint: [alias] [artifact-id]
allowed-tools: Bash(nlm:*), Bash(bash:*)
---

# /pp-archive

Triggers Phase 11 archive hook in single-artifact mode (alias + artifact-id), or sweep mode (no args).

## Args
$1 (alias) $2 (artifact-id)

## Steps
1. Auth gate.
2. If both args provided: `bash .claude/hooks/pp-nlm-studio-archive.sh "$1" "$2"`.
3. If no args: sweep mode — `bash .claude/hooks/pp-nlm-studio-archive.sh` (iterates all pp-* aliases, downloads any missing).
4. Print resulting `docs/nlm-archive/manifest.json` diff.

## Notes
- 0 quota.
- Idempotent: skips artifacts already in manifest.
