---
description: "Passing 125 flat tools to a single monolithic model causes context collapse — 2026 standard is a Router Agent delegating to specialized sub-agents"
type: debt-note
source: "conductor/comprehensive-audit.md §24"
confidence: proven
topics: ["[[architecture-decisions]]", "[[competitive-landscape]]"]
related_components: ["server/ai.ts", "server/ai-tools/index.ts"]
---

# Passing 125 flat tools to one model is outdated — needs multi-agent routing architecture

ProtoPulse passes all 125 AI tools in a flat array to a single Gemini model in `server/ai.ts`. By 2026 Genkit standards (documented in `js/multi-agent.md`), this is an anti-pattern that causes context collapse — the LLM's attention degrades under 125 tool schemas competing for context window space.

The state-of-the-art approach uses a Multi-Agent System: a "Router Agent" analyzes user intent and delegates to specialized agents (e.g., "Circuit Agent", "BOM Agent", "Export Agent"), each with a focused context window and tool subset. This prevents the primary LLM from drowning in irrelevant tool definitions.

Additionally, the 2026 EDA trend is shifting from reactive chatbots to L4 Autonomous Agents that constantly monitor DRC output and proactively suggest fixes, rather than waiting for user prompts.

---

Relevant Notes:
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- 125 tools × schema = massive token overhead
- [[ai-is-the-moat-lean-into-it]] -- multi-agent is the evolution of the AI moat
- [[ai-toolset-has-major-blindspots-in-history-variables-lifecycle-and-zones]] -- multi-agent would naturally organize tools by domain, eliminating the blindspot problem
- [[build-system-prompt-has-on-m-edge-resolution-bottleneck]] -- multi-agent splits the O(N*M) prompt into focused per-agent prompts
- [[no-genkit-evaluation-framework-means-ai-quality-is-vibes-only]] -- multi-agent architecture enables per-agent evaluation rather than monolithic testing

Topics:
- [[architecture-decisions]]
