---
description: MCP servers in ProtoPulse — 4 project servers + Arduino CLI globally, each extending a distinct capability dimension (secrets, data, browser, search, hardware)
type: moc
topics:
  - "[[dev-infrastructure]]"
---

# infrastructure-mcp

MCP (Model Context Protocol) servers extend Claude Code with capabilities beyond the built-in tools. ProtoPulse wires 4 project servers and inherits Arduino CLI globally. The full capability pentagon covers secrets access, database querying, browser automation, semantic search, and hardware programming.

## Notes

- [[four-mcp-servers-extend-four-distinct-capability-dimensions]] -- secrets, data, browser, search
- [[five-mcp-capability-dimensions-map-to-five-development-needs]] -- the full capability pentagon including hardware
- [[desktop-commander-is-required-for-reading-env-and-secrets]] -- Claude Code blocks .env access
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- connection string contains password
- [[playwright-mcp-provides-browser-automation-but-chrome-devtools-mcp-provides-dom-inspection]] -- two browser tools, different purposes
- [[qmd-mcp-enables-semantic-search-across-the-knowledge-vault]] -- semantic search over markdown
- [[arduino-cli-mcp-bridges-software-development-and-hardware-programming]] -- 16 tools for firmware lifecycle

---

Topics:
- [[dev-infrastructure]]
