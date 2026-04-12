---
description: How the Claude Code infrastructure is configured, wired, and maintained -- hooks, skills, agents, MCP servers, and settings
type: moc
topics: []
---

# dev-infrastructure

The Claude Code developer infrastructure powering ProtoPulse sessions. This covers hooks that enforce quality gates, skills that provide reusable workflows, agents that offer domain expertise, and MCP servers that extend tool access. Understanding this infrastructure is essential because it runs automatically on every file edit, every session start, and every stop -- shaping what Claude can and cannot do.

## Hooks

26 Claude Code hooks across 6 events (15 claudekit + 11 custom). See [[infrastructure-hooks]] for the full pipeline, latency analysis, and known ordering issues.

## Skills

23 project skills + 142 global skills + ~50 plugin skills = 215+ total. See [[claude-code-skills]] for the dedicated topic map covering the full ecosystem.

## Agents

37 agent definitions across 17 directories — 3 with persistent project memory, none with self-triggering patterns. See [[infrastructure-agents]] for the full catalog and memory configuration.

## MCP Servers

4 project MCP servers + Arduino CLI globally. See [[infrastructure-mcp]] for the full capability pentagon (secrets, data, browser, search, hardware).

## Configuration

- `.claude/settings.json` -- 19 matcher groups across 6 events, the hook wiring layer
- `.claudekit/config.json` -- timeout overrides for typecheck hooks (180s vs default 30s)
- `.mcp.json` -- MCP server definitions and timeouts
- `CLAUDE.md` -- 488 lines project instructions + 399 lines global instructions = 887 lines per session

## Plugins

32 plugins from 8 marketplaces. Most are user-scoped (load for all projects).

- [[thirty-two-plugins-installed-but-fewer-than-twelve-actively-used-in-protopulse]] -- cognitive overhead
- [[plugin-marketplaces-fragment-across-eight-registries-with-no-unified-catalog]] -- update drift and duplication
- [[plugin-hooks-can-conflict-with-project-hooks-on-shared-events]] -- shared event bus, no conflict detection
- [[context7-plugin-provides-real-time-library-docs-that-beat-stale-training-data]] -- real-time docs for modern libs

## Meta-Layer

The configuration that wires all components into a coherent system.

- [[the-meta-layer-connects-hooks-skills-agents-and-mcp-into-a-coherent-system]] -- settings.json + CLAUDE.md + .mcp.json
- [[claude-md-is-the-routing-table-that-maps-situations-to-skills]] -- routing coverage gaps
- [[hooks-enforce-rules-automatically-but-skills-require-explicit-invocation]] -- the enforcement gap
- [[context-compaction-erases-skill-routing-knowledge-causing-capability-amnesia]] -- long session degradation
- [[infrastructure-maintenance-follows-audit-debug-create-improve-cycle]] -- the maintenance workflow

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
- [[claude-code-skills]]
