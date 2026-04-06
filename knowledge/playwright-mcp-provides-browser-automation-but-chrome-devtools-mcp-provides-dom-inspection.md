---
description: Two browser MCP servers serve different purposes -- Playwright for page interaction, Chrome DevTools for data extraction and performance profiling
type: concept
source: ".mcp.json, ~/.claude/CLAUDE.md browser disambiguation section"
confidence: proven
topics: ["[[dev-infrastructure]]", "[[claude-code-skills]]"]
related_components: [".mcp.json", "~/.claude/CLAUDE.md"]
---

# Playwright MCP provides browser automation but Chrome DevTools MCP provides DOM inspection

ProtoPulse configures two browser-related MCP servers that appear similar but serve fundamentally different purposes. Playwright MCP (via `@playwright/mcp@latest`) provides user-interaction simulation: clicking, typing, navigating, filling forms, and taking screenshots. Chrome DevTools MCP provides data extraction: DOM snapshots as accessibility trees, network request inspection, console message reading, and performance trace capture.

The CLAUDE.md browser disambiguation table draws the critical line: Chrome DevTools = DATA EXTRACTION, Claude-in-Chrome = USER INTERACTION. A third layer exists via the superpowers-chrome plugin, which provides a `browsing` skill that wraps Chrome DevTools Protocol for direct browser session control.

The practical consequence for ProtoPulse development is that UI verification (mandated by AGENTS.md for every frontend change) requires choosing the right tool:
- **Verify a component renders**: Chrome DevTools `take_snapshot` to inspect the DOM tree
- **Verify a click handler works**: Playwright `computer` tool to simulate the click
- **Check network requests**: Chrome DevTools `list_network_requests`
- **Record a UI flow**: Claude-in-Chrome `gif_creator` for animated captures

The Chrome DevTools snapshot-first mandate ("ALWAYS `take_snapshot` FIRST before click/fill/hover/any interaction") exists because element UIDs (used for targeting interactions) are only available from snapshots. Attempting to interact without a snapshot produces "No snapshot found" errors. This is the most common browser automation failure pattern.

---

Relevant Notes:
- [[desktop-commander-is-required-for-reading-env-and-secrets]] -- another MCP server with a specific access niche
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- MCP configuration patterns

Topics:
- [[dev-infrastructure]]
- [[claude-code-skills]]
