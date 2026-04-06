---
description: How the Claude Code infrastructure is configured, wired, and maintained -- hooks, skills, agents, MCP servers, and settings
type: moc
---

# dev-infrastructure

The Claude Code developer infrastructure powering ProtoPulse sessions. This covers hooks that enforce quality gates, skills that provide reusable workflows, agents that offer domain expertise, and MCP servers that extend tool access. Understanding this infrastructure is essential because it runs automatically on every file edit, every session start, and every stop -- shaping what Claude can and cannot do.

## Hooks

Hooks fire automatically on Claude Code lifecycle events. ProtoPulse uses 26 hooks across 6 events (15 claudekit, 11 custom).

- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the full pipeline and its implications
- [[nine-posttooluse-groups-fire-on-every-write]] -- latency cost of the PostToolUse pipeline
- [[session-orient-and-validate-note-have-syntax-bugs]] -- concatenated lines break bash parsing
- [[blocking-typecheck-takes-33-to-44-seconds-on-protopulse]] -- known timeout issue, fixed via claudekit config
- [[auto-commit-vault-is-the-only-async-hook]] -- 25 blocking vs 1 async creates bottleneck risk
- [[two-hook-groups-have-no-explicit-matcher]] -- SessionStart and Stop groups fall through to default
- [[claudekit-and-custom-hooks-share-the-posttooluse-pipeline]] -- ordering matters, no coordination

## Skills

23 skills split into vault (Ars Contexta knowledge system) and project (ProtoPulse development) categories.

- [[vault-skills-outnumber-project-skills-seven-to-one]] -- 20 vault vs 3 project
- [[extract-is-the-largest-skill-at-1128-lines]] -- processing pipeline entry point
- [[ship-and-verify-overlap-on-commit-validation-territory]] -- potential confusion on which to use

## Agents

37 agent definitions across 17 directories, none with explicit trigger patterns.

- [[thirty-seven-agents-have-no-trigger-patterns]] -- agents cannot self-activate, must be manually invoked
- [[six-agents-cover-technologies-not-in-protopulse-stack]] -- kafka, loopback, nestjs, mongodb, jest, nextjs
- [[agent-definitions-total-twenty-thousand-lines]] -- context cost if loaded, but rarely referenced

## MCP Servers

3 MCP servers: playwright (browser automation), postgres (direct DB queries), desktop-commander (sensitive file ops).

- [[desktop-commander-is-required-for-reading-env-and-secrets]] -- Claude Code blocks .env access
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- connection string contains password

## Configuration

- `.claude/settings.json` -- 19 matcher groups across 6 events, the hook wiring layer
- `.claudekit/config.json` -- timeout overrides for typecheck hooks (180s vs default 30s)
- `.mcp.json` -- MCP server definitions and timeouts
- `CLAUDE.md` -- 488 lines project instructions + 399 lines global instructions = 887 lines per session

## Known Issues

- [[combined-claude-md-exceeds-800-lines-creating-context-pressure]] -- every session pays ~8600 tokens for instructions alone
- [[subagentsop-event-is-declared-but-has-no-hooks]] -- empty event array in settings.json
- [[claude-md-references-a-settings-skill-that-does-not-exist]] -- stale reference after skill removal

## Audit

Run the comprehensive audit: `bash ops/queries/infra-audit.sh`
Run the gap analysis: `bash ops/queries/infra-gaps.sh`

---

Topics:
- [[index]]
- [[gaps-and-opportunities]]
