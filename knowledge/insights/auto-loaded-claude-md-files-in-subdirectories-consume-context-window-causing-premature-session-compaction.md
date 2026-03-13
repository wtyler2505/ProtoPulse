---
summary: CLAUDE.md files placed in subdirectories (like knowledge/) are auto-loaded into every Claude Code session, consuming context window and causing premature compaction
areas: ["[[index]]"]
created: 2026-03-13
---

Claude Code automatically loads CLAUDE.md files from the working directory and its subdirectories. When ProtoPulse's `knowledge/` directory contained its own CLAUDE.md (with agent-specific instructions), it was loaded into every session alongside the root CLAUDE.md — doubling the baseline context consumption. This caused sessions to compact earlier, killing agent teammates and losing conversation history. The fix was to rename the knowledge system's config to `AGENTS.md` (which Claude Code doesn't auto-load) or ensure only the root CLAUDE.md exists. The lesson: every CLAUDE.md file is a permanent context tax.

## Topics

- [[index]]
