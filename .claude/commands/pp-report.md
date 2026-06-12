---
description: Generate a written report for a notebook. Auto-archives.
argument-hint: [alias=pp-core] [--format "Briefing Doc"|"Study Guide"|"Blog Post"|"Create Your Own"] [--prompt "..."]
allowed-tools: Bash(nlm:*), Bash(bash:*), AskUserQuestion
---

# /pp-report

## Args
$ARGUMENTS (defaults: alias=pp-core, format="Briefing Doc")

## Steps
1. Auth gate.
2. Parse args. Validate alias resolves: `nlm alias get <alias>`. Default format: "Briefing Doc".
3. `nlm report create <alias> --format "<format>" [--custom-prompt "<prompt>"] --confirm`. Capture artifact-id.
4. Poll `nlm studio status <alias>` until completed.
5. Trigger archive: `bash .claude/hooks/pp-nlm-studio-archive.sh <alias> <artifact-id>`.
6. Confirm artifact landed in `docs/nlm-archive/<alias>/`.

## Notes
- 1 report quota.
- "Create Your Own" requires --custom-prompt. AskUserQuestion if missing.
