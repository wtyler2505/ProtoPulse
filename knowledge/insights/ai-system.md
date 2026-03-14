---
summary: AI tools, prompts, streaming, multi-model routing, and trust patterns
type: moc
---

# AI System

How ProtoPulse's AI system works, where it falls short, and patterns for improving trust in AI-generated output.

## Insights

- [[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction]] — body-param projectId bypasses ownership middleware
- [[architecture-expansion-using-placeholder-first-pin-mapping-produces-semantically-wrong-schematics-that-erode-trust-in-ai-generated-designs]] — placeholder pins produce authoritative-looking but wrong schematics
- [[manufacturing-trust-requires-real-data-because-fake-confidence-is-worse-than-no-confidence]] — demo data erodes trust in AI output
- [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model]] — 6x3 phase-complexity matrix selects model tier
- [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix]] — in-flight promise map prevents duplicate API calls
- [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini]] — per-provider circuit breakers with automatic fallback
- [[view-aware-prompt-tiering-sends-full-data-for-the-active-view-and-summaries-for-everything-else-to-reduce-token-cost]] — context-aware prompt construction reduces token cost
