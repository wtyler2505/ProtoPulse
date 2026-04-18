---
description: How the Claude Code infrastructure is configured, wired, and maintained -- hooks, skills, agents, MCP servers, and settings
type: moc
topics: []
---

# dev-infrastructure

The Claude Code developer infrastructure powering ProtoPulse sessions. This covers hooks that enforce quality gates, skills that provide reusable workflows, agents that offer domain expertise, and MCP servers that extend tool access. Understanding this infrastructure is essential because it runs automatically on every file edit, every session start, and every stop -- shaping what Claude can and cannot do.

## Hooks

26 Claude Code hooks across 6 events (15 claudekit + 11 custom). They enforce quality gates automatically.

- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the full pipeline and its implications
- [[nine-posttooluse-groups-fire-on-every-write]] -- latency cost of the PostToolUse pipeline
- [[session-orient-and-validate-note-have-syntax-bugs]] -- concatenated lines break bash parsing
- [[blocking-typecheck-takes-33-to-44-seconds-on-protopulse]] -- known timeout issue, fixed via claudekit config
- [[auto-commit-vault-is-the-only-async-hook]] -- 25 blocking vs 1 async creates bottleneck risk
- [[two-hook-groups-have-no-explicit-matcher]] -- SessionStart and Stop groups fall through to default
- [[claudekit-and-custom-hooks-share-the-posttooluse-pipeline]] -- ordering matters, no coordination

## Skills

23 project skills + 142 global skills + ~50 plugin skills = 215+ total. See [[claude-code-skills]] for the dedicated topic map covering the full ecosystem.

## Agents

37 agent definitions across 17 directories — 3 with persistent project memory, none with self-triggering patterns.

- [[thirty-seven-agents-have-no-trigger-patterns]] -- agents cannot self-activate, must be manually invoked
- [[six-agents-cover-technologies-not-in-protopulse-stack]] -- kafka, loopback, nestjs, mongodb, jest, nextjs
- [[agent-definitions-total-twenty-thousand-lines]] -- context cost if loaded, but rarely referenced
- [[three-agents-have-persistent-project-memory]] -- oracle, eda-domain-reviewer, code-review-expert
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] -- memory + effort:high + GPT-5 fallback
- [[agent-teams-skill-is-the-mandated-parallel-execution-mechanism]] -- the only sanctioned parallel approach

## MCP Servers

4 project MCP servers + Arduino CLI globally. The full capability pentagon covers secrets access, database querying, browser automation, semantic search, and hardware programming.

- [[four-mcp-servers-extend-four-distinct-capability-dimensions]] -- secrets, data, browser, search
- [[five-mcp-capability-dimensions-map-to-five-development-needs]] -- the full capability pentagon including hardware
- [[desktop-commander-is-required-for-reading-env-and-secrets]] -- Claude Code blocks .env access
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- connection string contains password
- [[playwright-mcp-provides-browser-automation-but-chrome-devtools-mcp-provides-dom-inspection]] -- two browser tools, different purposes
- [[qmd-mcp-enables-semantic-search-across-the-knowledge-vault]] -- semantic search over markdown
- [[arduino-cli-mcp-bridges-software-development-and-hardware-programming]] -- 16 tools for firmware lifecycle

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

## Session & Testing Patterns

Patterns that keep long sessions and their tests honest.

- [[session-transcript-recovery-from-disk-enables-seamless-resumption-of-work-without-user-context-re-explanation]] -- `/resume` reads session JSON + git state to rebuild context after compaction or crash
- [[mocking-window-url-createobjecturl-resolves-typeerrors-in-tests-involving-browser-native-object-url-creation]] -- JSDOM lacks blob-URL API, Vitest setup must stub it for export-oriented views

## Known Issues

- [[combined-claude-md-exceeds-800-lines-creating-context-pressure]] -- every session pays ~8600 tokens for instructions alone
- [[subagentsop-event-is-declared-but-has-no-hooks]] -- empty event array in settings.json
- [[claude-md-references-a-settings-skill-that-does-not-exist]] -- stale reference after skill removal

## Audit

Run the comprehensive audit: `bash ops/queries/infra-audit.sh`
Run the gap analysis: `bash ops/queries/infra-gaps.sh`

---

Topics:
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
- [[gaps-and-opportunities]] — What ProtoPulse is missing, what's broken, and where the biggest opportunities are — the radar for development priorities
- [[claude-code-skills]] — How 250+ Claude Code skills organize into workflows -- plugins, project skills, slash commands, mastery skills, thinking tools, and the gaps between them
