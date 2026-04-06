---
description: The qmd MCP server provides semantic search over markdown files, enabling knowledge vault queries from within Claude Code sessions
type: claim
source: ".mcp.json"
confidence: likely
topics: ["[[dev-infrastructure]]", "[[methodology]]"]
related_components: [".mcp.json"]
---

# qmd MCP enables semantic search across the knowledge vault

The `.mcp.json` configures a `qmd` MCP server with the command `qmd mcp` and a 30-second timeout. This server indexes markdown files and provides semantic search capabilities -- meaning the agent can query the knowledge vault by meaning rather than exact text matching.

This fills a critical gap in the knowledge pipeline. The vault has 98+ notes across 12 topic maps, but navigating them relies on either wiki-links (manual traversal) or ripgrep (keyword matching). Semantic search enables queries like "what do we know about component authentication" that would match notes about API key encryption, session auth, and project ownership even if they don't contain the word "authentication."

The qmd server sits alongside desktop-commander (file ops), postgres (database), and playwright (browser) as the fourth MCP capability. But unlike the other three which extend what the agent can DO, qmd extends what the agent can FIND. It transforms the vault from a write-heavy system (notes are created and linked) into a read-efficient system (notes can be discovered by intent).

The 30-second timeout matches desktop-commander and is adequate for search operations over the current vault size, but may need increase as the vault grows past several hundred notes.

---

Relevant Notes:
- [[extract-connect-revisit-verify-mirrors-academic-methodology]] -- the pipeline that creates content for qmd to search
- [[knowledge-pipeline-has-ten-skills-covering-the-full-lifecycle]] -- the skills that produce vault content

Topics:
- [[dev-infrastructure]]
- [[methodology]]
