---
summary: CLAUDE.md files placed in subdirectories (like knowledge/) are auto-loaded into every Claude Code session, consuming context window and causing premature compaction
category: gotcha
areas: ["[[index]]"]
related insights:
  - "[[agent-team-teammates-die-on-context-compaction-so-parallel-work-requires-liveness-checks-after-session-continuation]] — the downstream consequence: premature compaction kills teammates"
  - "[[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — another resource consumption issue during agent team work"
created: 2026-03-13
---

Claude Code automatically loads CLAUDE.md files from the working directory and its subdirectories. When ProtoPulse's `knowledge/` directory contained its own CLAUDE.md (with agent-specific instructions), it was loaded into every session alongside the root CLAUDE.md — doubling the baseline context consumption. This caused sessions to compact earlier, killing agent teammates and losing conversation history. The fix was to rename the knowledge system's config to `AGENTS.md` (which Claude Code doesn't auto-load) or ensure only the root CLAUDE.md exists. The lesson: every CLAUDE.md file is a permanent context tax.

## Topics

- [[index]]
