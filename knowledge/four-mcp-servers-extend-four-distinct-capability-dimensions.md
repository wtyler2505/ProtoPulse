---
description: Each MCP server extends a unique dimension -- desktop-commander (file security), postgres (database), playwright (browser), qmd (knowledge search) -- with no overlap
type: concept
source: ".mcp.json"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".mcp.json"]
---

# four MCP servers extend four distinct capability dimensions

The ProtoPulse `.mcp.json` configures four MCP servers, each addressing a capability gap that Claude Code's built-in tools cannot fill:

1. **desktop-commander** (file security bypass): Reads .env, .mcp.json, credentials, and other sensitive files that Claude Code's permission system blocks. Also handles destructive operations (rm -rf). This is the only MCP server required by Claude Code's own architecture limitations.

2. **postgres** (direct database access): Runs SQL queries against the ProtoPulse PostgreSQL database without going through the Express API layer. Useful for debugging data issues, verifying migrations, and ad-hoc queries during development. Configured with `${DATABASE_URL}` environment variable interpolation.

3. **playwright** (browser automation): Provides page interaction tools (click, type, navigate, screenshot) for UI verification. Required by ProtoPulse's AGENTS.md mandate: "all frontend/UI/UX modifications MUST be tested and fully verified using browser automation BEFORE continuing."

4. **qmd** (semantic search): Indexes and searches markdown files semantically, enabling intent-based queries across the knowledge vault. The newest addition and the only MCP server focused on knowledge retrieval rather than system manipulation.

Additionally, the Chrome DevTools MCP (not in .mcp.json but available via plugins) provides a fifth dimension: DOM/network/performance inspection. The global CLAUDE.md also references Context7 as an MCP server instruction for library documentation lookup.

The timeout configurations reveal priority: playwright (60s), postgres (60s), desktop-commander (30s), qmd (30s). The browser and database servers get longer timeouts because their operations (page loads, complex queries) are inherently slower than file reads and text searches.

---

Relevant Notes:
- [[desktop-commander-is-required-for-reading-env-and-secrets]] -- dimension 1 deep dive
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- dimension 2 security concern
- [[playwright-mcp-provides-browser-automation-but-chrome-devtools-mcp-provides-dom-inspection]] -- dimension 3 + browser disambiguation
- [[qmd-mcp-enables-semantic-search-across-the-knowledge-vault]] -- dimension 4 deep dive

Topics:
- [[dev-infrastructure]]
