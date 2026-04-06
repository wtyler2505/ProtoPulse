---
description: "Claude handles complex tool-use reasoning while Gemini provides vision and fallback, with automatic failover"
type: decision
source: "docs/MASTER_BACKLOG.md, server/ai.ts"
confidence: proven
topics: ["[[architecture-decisions]]", [[competitive-landscape]]]
related_components: ["server/ai.ts", "server/circuit-breaker.ts"]
---

# Dual AI providers prevent vendor lock-in and enable specialized routing by task type

ProtoPulse routes AI requests to different providers based on task characteristics. Claude handles complex multi-step tool-use (125 tools) and reasoning tasks. Gemini handles vision tasks (component identification from camera, napkin-to-schematic conversion) and serves as an automatic fallback when Claude is unavailable. A circuit breaker (`server/circuit-breaker.ts`) with CLOSED/OPEN/HALF_OPEN states manages provider health, and `FallbackProviderConfig` triggers automatic provider switching on 5xx errors or timeouts.

This matters because ProtoPulse's AI is not a chatbot -- it is the primary control surface for 125 tools that directly manipulate project state. If the AI provider goes down, the user loses the ability to add components, run validation, generate exports, and navigate the tool. A single-provider architecture would make ProtoPulse's core value proposition dependent on one company's uptime.

The cost is maintaining provider-specific streaming implementations and model ID constants. When model IDs change (which they do regularly -- e.g., `claude-haiku-4-5-20251001` to `claude-sonnet-4-6-20250514`), the constants file must be updated. Per-provider API key management was fixed in Wave 49 to support separate localStorage keys for Anthropic and Gemini.

---

Relevant Notes:
- [[ai-is-the-moat-lean-into-it]] -- AI is the differentiator, so it must be reliable
- [[protopulse-ai-breadth-is-6x-flux-ai]] -- tool breadth requires robust routing

Topics:
- [[architecture-decisions]]
- [[competitive-landscape]]
