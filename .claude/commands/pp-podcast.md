---
description: Generate an audio overview (podcast) for a notebook. Auto-archives to docs/nlm-archive/.
argument-hint: [alias=pp-journal] [--format deep_dive|brief|critique|debate] [--length short|default|long]
allowed-tools: Bash(nlm:*), Bash(bash:*), Bash(echo:*)
---

# /pp-podcast

Generate audio overview, poll until completed, then trigger Phase 11 archive hook.

## Args
$ARGUMENTS  (defaults: alias=pp-journal, format=deep_dive, length=default)

## Steps
1. Auth gate.
2. Parse args. Validate alias resolves: `nlm alias get <alias>`.
3. Run: `nlm audio create <alias> --format <format> --length <length> --confirm`. Capture artifact-id from output.
4. Poll: `nlm studio status <alias>` until artifact `status: completed`. Print URL.
5. Trigger archive: `bash .claude/hooks/pp-nlm-studio-archive.sh <alias> <artifact-id>`.
6. Confirm artifact landed in `docs/nlm-archive/<alias>/`.

## Notes
- 1 audio quota (Ultra: 200/day).
- Title scheme: `Audio: Week of <ISO-Monday>` for weekly cron, otherwise alias+date.
- Anti-hallucination: never claim "podcast generated" until status=completed (per nlm-skill SKILL.md L246-251).
