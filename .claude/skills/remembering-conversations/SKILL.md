---
name: remembering-conversations
description: Search previous Claude Code conversations for facts, patterns, decisions, and context using semantic or text search. Use when partner mentions past discussions, debugging familiar issues, or seeking historical context about decisions and patterns. Triggers on "we discussed", "past conversation", "previous session", "remember when", "search conversations", "conversation history".
version: 1.2.0
allowed-tools: Bash(search-conversations:*), Task, Read, Glob
---

# Remembering Conversations

Search archived conversations using semantic similarity or exact text matching.

**Core principle:** Search before reinventing.

**Announce:** "I'm searching previous conversations for [topic]."

**Setup:** See INDEXING.md

## When to Use

**Search when:**
- Your human partner mentions "we discussed this before"
- Debugging similar issues
- Looking for architectural decisions or patterns
- Before implementing something familiar

## When NOT to Use

Do NOT use this skill when:
- **Info in current conversation** → Already in context
- **Question about current codebase** → Use Grep/Read instead
- **Search tool not configured** → See INDEXING.md first
- **Generic coding question** → Use WebSearch or documentation

## In-Session Use

**Always use subagents** (50-100x context savings). See skills/using-skills for workflow.

**Manual/CLI use:** Direct search (below) for humans outside Claude Code sessions.

## Direct Search (Manual/CLI)

**Tool:** `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/remembering-conversations/tool/search-conversations`

**Modes:**
```bash
search-conversations "query"              # Vector similarity (default)
search-conversations --text "exact"       # Exact string match
search-conversations --both "query"       # Both modes
```

**Flags:**
```bash
--after YYYY-MM-DD    # Filter by date
--before YYYY-MM-DD   # Filter by date
--limit N             # Max results (default: 10)
--help                # Full usage
```

**Examples:**
```bash
# Semantic search
search-conversations "React Router authentication errors"

# Find git SHA
search-conversations --text "a1b2c3d4"

# Time range
search-conversations --after 2025-09-01 "refactoring"
```

Returns: project, date, conversation summary, matched exchange, similarity %, file path.

**For details:** Run `search-conversations --help`

---

## Related Skills

- **memory-mastery** - Knowledge graph for persistent entity memory
- **project-context** - Loading project context from code and docs
- **research** - General research methodology

---

## Changelog

- v1.2.0 (2025-01-15): Added formal "When NOT to Use" section, Related Skills, Changelog
- v1.1.0 (2024-12): Simplified format, added subagent recommendation
- v1.0.0 (2024-11): Initial conversation search skill
