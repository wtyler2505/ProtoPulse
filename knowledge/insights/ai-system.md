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
- [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles]] — per-type watchdog timeouts encode domain-specific runtime profiles for AI analysis (5min) vs export (10min)
- [[ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches]] — accumulator pattern for executing multi-action AI responses without stale closure bugs
- [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop]] — AI job queue drains as step 2 of shutdown, before HTTP server close

## Connection Clusters

### Cost Optimization Pipeline
The AI system has a layered cost optimization pipeline: [[view-aware-prompt-tiering-sends-full-data-for-the-active-view-and-summaries-for-everything-else-to-reduce-token-cost|prompt tiering]] minimizes tokens, [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model|model routing]] selects the cheapest sufficient model, [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix|deduplication]] prevents redundant calls. Each layer operates independently, and together they compound savings.

### Resilience Stack
Three patterns form the AI resilience stack: [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix|deduplication]] prevents duplicate calls to healthy providers, [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini|circuit breaking]] prevents calls to failing providers, and [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles|exponential backoff]] spaces out retries during recovery.
