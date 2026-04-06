---
description: The postgres MCP server configuration contains a connection string with inline username and password in .mcp.json
type: claim
source: ".mcp.json"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".mcp.json"]
---

# postgres MCP has inline credentials in mcp.json

The `.mcp.json` file configures the postgres MCP server with a connection string argument: `postgresql://protopulse:protopulse@localhost:5432/protopulse`. The username (`protopulse`) and password (`protopulse`) are embedded directly in the file.

This is a local development database with matching user/password, so the immediate security risk is low. But .mcp.json is checked into the git repository (it is not in .gitignore), meaning these credentials are version-controlled and visible to anyone with repo access. If the database credentials were ever changed to something non-trivial, they would be in git history permanently.

The proper pattern would be to reference an environment variable in the connection string (e.g., `$DATABASE_URL`) or read from .env, but MCP server configs do not support environment variable interpolation in their current format. This is a platform limitation, not a project oversight.

---

Relevant Notes:
- [[desktop-commander-is-required-for-reading-env-and-secrets]] -- the env file access pattern

Topics:
- [[dev-infrastructure]]
