---
description: Claude Code blocks direct access to .env and credential files -- the desktop-commander MCP server is the mandatory workaround
type: claim
source: ".mcp.json, ~/.claude/CLAUDE.md"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".mcp.json"]
---

# desktop-commander is required for reading env and secrets

Claude Code's built-in permission system blocks the Read, Edit, Write, and Bash tools from accessing sensitive files (.env, .env.local, .env.production, .mcp.json, credentials.json, *.pem, *.key). This is a security feature, but it means the standard toolchain cannot read environment configuration.

The desktop-commander MCP server provides an alternative file access path that bypasses Claude Code's permission layer. The global CLAUDE.md documents the full mapping: `mcp__desktop-commander__read_file` instead of Read, `mcp__desktop-commander__edit_block` instead of Edit, etc. The rm -rf command is also routed through desktop-commander to avoid accidental destructive operations.

The server is configured with a 30-second timeout -- the shortest of the three MCP servers. This is adequate for file operations but could be tight for search operations across large directories.

The critical dependency chain is: `.env` file access requires desktop-commander, which requires the `desktop-commander` binary (found at `/home/linuxbrew/.linuxbrew/bin/desktop-commander`). If Linuxbrew is not available or the binary is removed, all secret file operations fail silently.

---

Relevant Notes:
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- another credential concern

Topics:
- [[dev-infrastructure]]
