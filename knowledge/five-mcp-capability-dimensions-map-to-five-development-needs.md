---
description: MCP servers map cleanly to development needs -- secrets, data, browser, search, hardware -- forming a capability pentagon that Claude Code alone cannot cover
type: concept
source: ".mcp.json, MCP tool list"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".mcp.json"]
---

# five MCP capability dimensions map to five development needs

The MCP server ecosystem addresses five development needs that Claude Code's built-in tools (Read, Write, Edit, Bash, Grep, Glob) cannot handle:

| Need | MCP Server | Why Built-in Fails |
|------|-----------|-------------------|
| Read secrets | desktop-commander | Claude Code permission system blocks .env, .mcp.json, *.key |
| Query database | postgres | No built-in SQL tool; Bash + psql works but loses type safety |
| Test UI | playwright + chrome-devtools | No built-in browser; screenshots and DOM inspection need real browsers |
| Search knowledge | qmd | Grep is keyword-only; semantic search requires embedding models |
| Program hardware | arduino-cli-mcp | No built-in serial/USB; firmware compilation needs native toolchains |

The Arduino CLI MCP is not in the project .mcp.json but is available as a global MCP server. Together with the four project-level servers, these five dimensions cover the full ProtoPulse development surface: secrets for configuration, database for state, browser for UI, search for knowledge, and hardware for the EDA platform's core purpose.

Each MCP server is a standalone process (npx, desktop-commander binary, qmd binary, or arduino-cli wrapper) that communicates via JSON-RPC. Failure of one server does not cascade to others. But there is no health monitoring -- a crashed MCP server produces silent tool failures that can be confused with permission errors or network issues.

---

Relevant Notes:
- [[four-mcp-servers-extend-four-distinct-capability-dimensions]] -- the project-level four
- [[arduino-cli-mcp-bridges-software-development-and-hardware-programming]] -- the hardware dimension
- [[desktop-commander-is-required-for-reading-env-and-secrets]] -- the secrets dimension

Topics:
- [[dev-infrastructure]]
