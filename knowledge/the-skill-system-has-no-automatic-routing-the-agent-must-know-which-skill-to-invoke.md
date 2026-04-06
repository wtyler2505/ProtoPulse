---
description: Unlike hooks which fire automatically on events, skills require explicit invocation -- the agent must match user intent to the correct skill name
type: insight
source: "Claude Code skill invocation mechanism, CLAUDE.md routing tables"
confidence: proven
topics: ["[[claude-code-skills]]", "[[gaps-and-opportunities]]"]
related_components: ["CLAUDE.md", ".claude/skills/"]
---

# the skill system has no automatic routing the agent must know which skill to invoke

Skills are passive capabilities. They sit in the skills directory with trigger descriptions and wait to be invoked via the Skill tool or a slash command. There is no middleware that watches user messages and automatically activates matching skills. The entire routing burden falls on the agent's ability to pattern-match user intent against its knowledge of available skills.

This creates a funnel problem. 215+ skills are available, but the agent's effective skill repertoire is limited to: (a) skills mentioned in CLAUDE.md routing tables, (b) skills the user explicitly requests via slash commands, and (c) skills the agent has "seen" recently in the conversation. A skill not in any of these three categories is effectively invisible.

The `using-superpowers` meta-skill attempts to address this by running at session start and establishing routing conventions. The `using-skills` skill is described as a "MANDATORY skill enforcement system -- check at session start and before EVERY task." But enforcement depends on the agent remembering to check, which is itself an un-automated routing decision.

The contrast with hooks is instructive. Hooks fire automatically: a PostToolUse hook on Write runs on EVERY write, zero routing needed. Skills fire manually: the agent must recognize the situation, recall the skill, and invoke it. This means hooks are reliable-but-inflexible (they always run, even when unwanted), while skills are flexible-but-fragile (they can match any situation, but only if remembered).

The gap between hooks and skills is where quality drops. A developer forgets to invoke /verify before claiming completion. A code change skips /tdd-mastery because the agent defaulted to direct implementation. The hooks catch some of these (typecheck, lint) but not the workflow-level discipline (brainstorm before plan, plan before execute).

---

Relevant Notes:
- [[infrastructure-skills-exist-but-are-not-referenced-in-any-workflow]] -- the discovery failure mode
- [[slash-commands-are-the-primary-user-interface-to-the-skill-system]] -- slash commands as the main invocation path
- [[twelve-deprecated-skills-still-exist-alongside-their-replacements]] -- namespace pollution makes routing harder

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]
