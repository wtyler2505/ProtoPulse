---
description: Hook-debug, hook-create, cmd-create, and other infrastructure management skills are available but invisible -- no CLAUDE.md workflow or routing table references them
type: insight
source: "~/.claude/commands/ listings, CLAUDE.md"
confidence: proven
topics: ["[[claude-code-skills]]", "[[gaps-and-opportunities]]"]
related_components: ["~/.claude/commands/hook-debug.md", "~/.claude/commands/hook-create.md", "~/.claude/commands/cmd-create.md"]
---

# infrastructure skills exist but are not referenced in any workflow

The global commands directory contains a rich set of infrastructure management tools: hook-debug (list, validate, test, check logs, fix issues), hook-create (create hooks from natural language), hook-wizard (interactive guided creation), hook-patterns (cookbook of security/quality/logging patterns), hook-status (view current hook config), cmd-create (create slash commands), cmd-wizard (interactive command creation), cmd-validate (syntax checking), cmd-auditor (comprehensive audit + fix-it wizard), cmd-list (list all commands), and cmd-patterns (workflow pattern cookbook).

None of these appear in CLAUDE.md's routing tables, workflow chains, or recommended procedures. The CLAUDE.md section on Claude Code infrastructure self-audit mentions `bash ops/queries/infra-audit.sh` but doesn't reference hook-debug or cmd-auditor. A developer experiencing a hook failure would need to know these commands exist independently.

The same pattern applies to skill management tools: skill-create, skill-edit, skill-test, skill-troubleshoot, skill-share, skill-garden, and skill-sync -- a complete skill lifecycle toolkit that's never referenced in any workflow documentation.

This is a discoverability gap, not a capability gap. The tools exist and work. They just can't be found by someone who doesn't already know about them.

---

Relevant Notes:
- [[twelve-deprecated-skills-still-exist-alongside-their-replacements]] -- another discoverability problem
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the hooks these skills manage

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]
