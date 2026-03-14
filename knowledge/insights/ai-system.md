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

- [[ai-tool-registry-uses-client-side-dispatch-stubs-for-tools-that-cannot-execute-server-side]] — 88 tools but many use clientAction() stubs that validate server-side and dispatch to client, splitting execution across contexts
- [[design-agent-hardcodes-confirmed-true-bypassing-destructive-tool-confirmation-enforcement]] — the agentic AI loop bypasses tool confirmation, giving the agent unconfirmed access to all 88 tools
- [[circuit-ai-selectively-enables-extended-thinking-based-on-operation-type-not-model-or-prompt-size]] — extended thinking selectively enabled for generation/analysis but not review or agent loops
- [[local-intent-parsing-produces-aiactions-not-direct-mutations-to-unify-offline-and-online-execution-paths]] — offline commands produce the same AIAction objects as AI-generated responses, enabling no-API-key functionality
- [[error-message-mapping-uses-cascading-pattern-matchers-to-translate-raw-api-errors-into-actionable-guidance]] — 7-stage error cascade translates raw AI errors into actionable user-facing messages with retryable flags
- [[batch-analysis-tracking-lives-in-an-in-memory-map-that-does-not-survive-server-restarts]] — Anthropic batch analysis tracking lost on restart; orphaned batches can't be correlated back to projects
- [[api-key-management-uses-sentinel-values-and-dual-persistence-to-keep-real-keys-invisible-to-the-client]] — STORED_KEY_SENTINEL keeps real keys invisible; dual persistence with localStorage fallback for unauthenticated users

## Connection Clusters

### Cost Optimization Pipeline
The AI system has a layered cost optimization pipeline: [[view-aware-prompt-tiering-sends-full-data-for-the-active-view-and-summaries-for-everything-else-to-reduce-token-cost|prompt tiering]] minimizes tokens, [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model|model routing]] selects the cheapest sufficient model, [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix|deduplication]] prevents redundant calls. Each layer operates independently, and together they compound savings.

### Resilience Stack
Three patterns form the AI resilience stack: [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix|deduplication]] prevents duplicate calls to healthy providers, [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini|circuit breaking]] prevents calls to failing providers, and [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles|exponential backoff]] spaces out retries during recovery.

### Tool Execution Model
The 88 AI tools split into two execution paths: server-side tools execute immediately, while [[ai-tool-registry-uses-client-side-dispatch-stubs-for-tools-that-cannot-execute-server-side|client-dispatch stubs]] validate server-side but delegate execution to the client's action executor. The [[design-agent-hardcodes-confirmed-true-bypassing-destructive-tool-confirmation-enforcement|design agent bypasses confirmation]] for both paths. [[local-intent-parsing-produces-aiactions-not-direct-mutations-to-unify-offline-and-online-execution-paths|Offline local intent parsing]] is a third action source that produces the same AIAction objects, making ProtoPulse usable without any AI API key.

### Error Experience
The error pipeline has two stages: [[storage-error-maps-postgresql-error-codes-to-http-status-giving-routes-structured-error-semantics-without-db-coupling|StorageError]] translates DB errors to HTTP status on the server, then [[error-message-mapping-uses-cascading-pattern-matchers-to-translate-raw-api-errors-into-actionable-guidance|error-messages.ts]] translates HTTP/AI errors to user-facing guidance on the client. This two-stage refinement ensures no error reaches the user as a raw stack trace.
