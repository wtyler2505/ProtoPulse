---
description: The Context7 plugin resolves library IDs and queries current documentation, compensating for the 12+ month training data lag in AI models
type: claim
source: "context7@claude-plugins-official, ~/.claude/CLAUDE.md Context7 section"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]", "[[methodology]]"]
related_components: ["~/.claude/plugins/cache/claude-plugins-official/context7/"]
---

# Context7 plugin provides real-time library docs that beat stale training data

The Context7 plugin exposes two tools: `resolve-library-id` (find the canonical identifier for a library) and `query-docs` (fetch current documentation for a specific question). The workflow is sequential -- resolve first, then query -- because the query tool requires the resolved ID as input.

ProtoPulse's CLAUDE.md mandates Context7 usage "before implementing with any library API you're not 100% certain about" and explicitly states "Training data may be stale." This is pragmatically true for the ProtoPulse stack: Express 5, Vite 7, Tailwind v4, Drizzle ORM, React 19, and Vitest 4 are all at versions released after typical model training cutoffs. Without Context7, the agent would hallucinate APIs from older versions.

The rate limiting rules (max 3 resolve calls per question, max 3 query calls per question) exist because Context7 fetches documentation in real-time from external sources. Each call has latency, and excessive calls waste context window on redundant results. The "be specific in queries" guidance prevents the common failure of asking a vague question like "auth" and getting back 50KB of irrelevant Express middleware documentation.

Context7 is installed both as a plugin (context7@claude-plugins-official) and as an MCP server instruction (claude.ai Context7), which means there are actually two sets of tools available: `mcp__context7__resolve-library-id` / `mcp__context7__get-library-docs` and `mcp__claude_ai_Context7__resolve-library-id` / `mcp__claude_ai_Context7__query-docs`. This duplication is a platform artifact, not intentional.

---

Relevant Notes:
- [[combined-claude-md-exceeds-800-lines-creating-context-pressure]] -- Context7 mandate adds to CLAUDE.md size
- [[superpowers-plugin-provides-the-core-development-lifecycle]] -- Context7 supplements the lifecycle with research

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
- [[methodology]]
