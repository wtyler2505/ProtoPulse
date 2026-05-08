---
description: Generate a written report for a notebook. Auto-archives.
argument-hint: [alias=pp-codebase] [--format "Briefing Doc"|"Study Guide"|"Blog Post"|"Create Your Own"] [--prompt "..."]
allowed-tools: Bash(nlm:*), Bash(bash:*)
---

# /pp-report

## Args
$ARGUMENTS

## Steps
1. Auth gate.
2. Parse args. Default format: "Briefing Doc".
3. `nlm report create <alias> --format "<format>" [--custom-prompt "<prompt>"] --confirm`. Capture artifact-id.
4. Poll `nlm studio status <alias>` until completed.
5. Trigger archive.

## Notes
- 1 report quota.
- "Create Your Own" requires --custom-prompt. AskUserQuestion if missing.
