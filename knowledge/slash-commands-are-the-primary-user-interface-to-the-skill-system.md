---
description: 46 global + 12 project slash commands form the primary user-facing interface to skills, but many skills lack corresponding commands
type: claim
source: "~/.claude/commands/, .claude/commands/"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: ["~/.claude/commands/", ".claude/commands/"]
---

# slash commands are the primary user interface to the skill system

Users interact with skills primarily through slash commands typed in the Claude Code prompt. The system has 46 global commands (in `~/.claude/commands/`) and 12 project commands (in `.claude/commands/`), totaling 58 direct invocation points.

Project commands are organized into namespaced groups: `agents-md` (cli/init/migration), `checkpoint` (create/list/restore), `config` (bash-timeout), `dev` (cleanup), `gh` (repo-init), `git` (checkout/commit/ignore-init/push/status), and `spec` (create/decompose/execute/validate). Plus standalone commands: code-review, create-command, create-subagent, research, and validate-and-fix.

The gap: many skills have no corresponding slash command. The 23 project skills all have slash command equivalents (the skill IS the command). But of the 142 global skills, only ~46 have dedicated command wrappers. The remainder are invocable via the Skill tool but have no autocomplete-discoverable slash command. Some skills rely entirely on the plugin system for invocation (superpowers:brainstorming, arscontexta:help) rather than slash commands.

This creates a two-tier discoverability problem: slash commands are visible in autocomplete, skills without commands are invisible unless you know the name.

---

Relevant Notes:
- [[infrastructure-skills-exist-but-are-not-referenced-in-any-workflow]] -- the invisible skill problem
- [[four-overlapping-task-management-systems-fragment-attention]] -- command naming confusion

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
