---
description: CLAUDE.md, settings.json, and .mcp.json form a meta-layer that wires hooks, skills, agents, and MCP servers into a coherent development system
type: concept
source: "CLAUDE.md, .claude/settings.json, .mcp.json"
confidence: proven
topics: ["[[dev-infrastructure]]", "[[claude-code-skills]]"]
related_components: ["CLAUDE.md", ".claude/settings.json", ".mcp.json"]
---

# the meta-layer connects hooks skills agents and MCP into a coherent system

Four component types serve four functions: hooks enforce quality gates (automatic, event-driven), skills encode workflows (manual, invocation-driven), agents provide domain expertise (manual, delegation-driven), and MCP servers extend tool capabilities (always available, tool-driven). The meta-layer is the configuration that connects these components into a functioning development system.

The meta-layer has three files:

**settings.json** -- Wires hooks to lifecycle events. Defines 19 matcher groups across 6 events. This is the "automatic enforcement" layer. A hook exists only if settings.json registers it; an unregistered hook script is dead code.

**CLAUDE.md** -- Routes situations to skills and agents. Defines routing tables, workflow chains, and mandatory protocols. This is the "cognitive routing" layer. A skill exists only if CLAUDE.md references it; an undocumented skill is discoverable only by accident.

**.mcp.json** -- Declares MCP server availability and timeouts. This is the "capability extension" layer. An MCP server exists only if .mcp.json configures it; an unconfigured MCP binary on PATH does nothing.

The meta-layer's health determines the system's effectiveness. When settings.json has a bug (SubagentStop declared but empty), hook enforcement has a gap. When CLAUDE.md has a stale reference (settings skill that doesn't exist), routing fails. When .mcp.json has inline credentials, security is compromised.

The infra-audit.sh script checks meta-layer health, but it runs on-demand rather than automatically. There is no hook that validates the meta-layer itself -- the quality enforcement system does not enforce its own quality.

---

Relevant Notes:
- [[claude-md-is-the-routing-table-that-maps-situations-to-skills]] -- CLAUDE.md's role in detail
- [[hooks-enforce-rules-automatically-but-skills-require-explicit-invocation]] -- the enforcement gap
- [[four-mcp-servers-extend-four-distinct-capability-dimensions]] -- MCP server architecture
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- settings.json wiring

Topics:
- [[dev-infrastructure]]
- [[claude-code-skills]]
