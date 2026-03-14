---
name: AI request deduplication uses an in-flight promise map keyed by provider+project+message prefix
description: Concurrent identical AI chat requests share a single API call via an activeRequests Map that stores the in-flight promise, keyed by provider:projectId:first-100-chars — callers await the same promise rather than spawning duplicate API calls
type: insight
---

# AI Request Deduplication Uses an In-Flight Promise Map Keyed by Provider, Project, and Message Prefix

In `server/ai.ts`, the `processAIMessage()` function implements request deduplication to prevent duplicate AI API calls when multiple clients (or retries) send the same message simultaneously.

The mechanism:
1. A `requestKey()` function generates a composite key: `${provider}:${projectId}:${message.slice(0, 100)}`
2. Before calling the AI provider, the code checks `activeRequests.get(dedupeKey)` — if a matching promise exists, the caller awaits it instead of making a new API call
3. If no match exists, the new API call promise is stored in `activeRequests.set(dedupeKey, promise)`
4. The promise is removed from the map in a `.finally()` block

**Key design decision:** The dedup key uses only the first 100 characters of the message. This is a deliberate trade-off: it prevents dedup from failing when messages differ only in trailing whitespace or punctuation, at the cost of theoretically conflating two genuinely different 100+ char messages that share the same prefix. In practice, this is extremely unlikely for natural-language chat messages.

**Subtle bug risk:** The key includes `projectId` (falling back to `appState.projectName`), which correctly scopes deduplication to a single project. Without this, users on different projects sending "show me the architecture" would incorrectly share results.

**Why this is non-obvious:** This pattern is easy to miss during code review because it's a performance optimization that doesn't affect correctness for single-client usage. It only matters under concurrent load — double-clicks, SSE reconnection retries, or multiple browser tabs.

**Related:**

- [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini]] — dedup and circuit breaking are complementary resilience layers: dedup prevents duplicate calls to a healthy provider, the breaker prevents any calls to a failing one
- [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model]] — dedup happens after model routing: the dedup key includes the provider (selected by routing), so switching providers creates a new dedup slot
- [[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects]] — the `activeRequests` Map is another in-memory Map with a composite key; unlike the Maps flagged for namespace isolation, this one correctly includes `projectId` in the key
- [[view-aware-prompt-tiering-sends-full-data-for-the-active-view-and-summaries-for-everything-else-to-reduce-token-cost]] — prompt caching (via `hashAppState()`) and request dedup are complementary: caching avoids rebuilding the prompt, dedup avoids sending it twice
