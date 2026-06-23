---
description: Capture a physical bench observation to pp-bench notebook.
argument-hint: <observation>
allowed-tools: Bash(nlm:*), Bash(date:*), Bash(touch:*), AskUserQuestion
---

# /pp-bench

Bench engineer's notebook entry. Hardware-grounded.

## Args
$ARGUMENTS

## Steps
1. Auth gate.
2. AskUserQuestion for optional fields:
   - Part number(s)
   - Vendor + batch
   - Measurement (V/A/Hz/°C)
   - Hypothesis / conclusion
3. Construct body with the optional fields included.
4. Title: `$(date -u +%Y-%m-%d) — <part-or-topic>`.
5. Preview + confirm.
6. `nlm note create pp-bench "<body>" --title "<title>"`.
7. `touch ~/.claude/state/pp-nlm/cache-invalidate`.

## Notes
- 0 quota.
- Citation rule: part number + vendor + measurement source on every claim.
- Alias resolution: `pp-bench` is a compatibility alias resolving to `pp-hardware`; run `nlm alias get pp-bench` before write.
