---
description: Maintaining Claude Code infrastructure uses a four-step cycle -- audit current state, debug failures, create/fix components, then improve CLAUDE.md routing
type: pattern
source: "ops/queries/infra-audit.sh, ~/.claude/commands/hook-debug.md, ~/.claude/commands/hook-create.md, ~/.claude/skills/claude-md-improver/"
confidence: proven
topics: ["[[dev-infrastructure]]", "[[methodology]]"]
related_components: ["ops/queries/infra-audit.sh", "~/.claude/skills/claude-md-improver/"]
---

# infrastructure maintenance follows audit debug create improve cycle

When Claude Code infrastructure (hooks, skills, settings, MCP servers) needs maintenance, four tools form a natural cycle:

1. **Audit** (`bash ops/queries/infra-audit.sh`): Comprehensive scan of all 23 skills, 11 hooks, 10 agents, 3 MCP servers, settings.json, and both CLAUDE.md files. Identifies broken scripts, stale references, missing matchers, and conflict patterns. Also: `/cmd-auditor` for slash commands, `/skill-garden` for skill health.

2. **Debug** (`/hook-debug`): When a specific hook fails, this skill lists, validates, tests, checks logs, and proposes fixes. Also: `/skill-troubleshoot` for skills that fail to trigger, `/hook-status` for viewing current hook configuration across all settings files.

3. **Create/Fix** (`/hook-create`, `/hook-wizard`, `/cmd-create`): Natural language hook and command creation. "Block rm -rf" becomes a PreToolUse hook. "Format on save" becomes a PostToolUse hook. `/hook-patterns` and `/cmd-patterns` provide cookbooks of proven patterns.

4. **Improve** (`/claude-md-improver`): After infrastructure changes, the routing table (CLAUDE.md) must be updated. This skill audits CLAUDE.md for stale references, missing skill documentation, and routing gaps. Without this step, new hooks and skills exist but the agent does not know when to invoke them.

The cycle is reactive (something broke -> audit -> debug -> fix -> update routing) but should also be proactive (periodic audit -> find drift -> fix before it causes failures). The ProtoPulse AGENTS.md section on "Claude Code Infrastructure Self-Audit" documents the reactive path but not a scheduled proactive cadence.

---

Relevant Notes:
- [[infrastructure-skills-exist-but-are-not-referenced-in-any-workflow]] -- the discoverability gap this cycle addresses
- [[session-orient-and-validate-note-have-syntax-bugs]] -- example of what audit catches
- [[claudekit-and-custom-hooks-share-the-posttooluse-pipeline]] -- ordering issues found via debug

Topics:
- [[dev-infrastructure]]
- [[methodology]]
