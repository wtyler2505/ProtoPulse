---
summary: error-messages.ts implements a cascading classification pipeline (abort → network TypeError → timeout → HTTP status → AI error patterns → network heuristic → fallback) that converts raw errors into user-facing messages with retryable flags
category: implementation-detail
areas: ["[[index]]"]
related insights:
  - "[[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — the error messages similarly embed actionable guidance, not just error codes"
  - "[[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — beginner-friendly error messages are essential for the maker audience"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker.md
  - the-maker-to-professional-spectrum-is-the-fundamental-ux-tension.md
---

The error message mapping system (`client/src/lib/error-messages.ts`) converts raw JavaScript errors from fetch, React Query, and SSE streaming into `UserFacingError` objects with title, description, retryable flag, and optional request ID. The mapping follows a strict cascade order that prioritizes specific error types over general patterns:

1. **AbortError** (user cancelled) — no request ID since the request never completed
2. **Network TypeError** (fetch failed) — regex matches `fetch|network|failed to fetch|load`
3. **Timeout** — regex matches `timed?\s*out|timeout`
4. **HTTP status** — extracts `NNN: body` format from `throwIfResNotOk` error messages via regex `^\d{3}:\s`
5. **AI-specific patterns** — 6 regex matchers for invalid API key, overloaded model, context too long, content filtered, billing issues, and model unavailable
6. **Generic network heuristic** — catches `ECONNREFUSED`, `ENOTFOUND`, `ERR_CONNECTION`
7. **Fallback** — wraps the raw message in a generic "Something went wrong"

The non-obvious design decisions:

- **retryable flag**: Each error category explicitly declares whether retrying makes sense. 409 (Conflict), 429 (Rate Limited), 500, 502, 503, 504 are retryable. 400, 401, 403, 404, 413, 422 are not. AI-specific errors are retryable only for capacity/overload issues.

- **SSE error bridging**: `mapStreamErrorToUserMessage` creates a synthetic `Error` object from SSE error payloads and feeds it through the same `mapErrorToUserMessage` pipeline. If the SSE payload includes a numeric `code` field, it's treated as an HTTP status code before falling through to pattern matching.

- **Request ID propagation**: The `X-Request-Id` header is extracted and appended to error descriptions as `(Request ID: xxx)`, giving users a reference for bug reports. The ID flows through both the global React Query error handler and per-component error handlers.

- **Global error handler**: The QueryClient's cache-level `onError` is set via `queryClient.getQueryCache().config.onError`, a non-obvious API that catches errors from all queries regardless of whether individual queries have their own `onError` handlers. This ensures no query failure is silently swallowed.

---

Related:
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — error messages embed the same actionable-guidance pattern as DRC explanations
- [[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — beginner-friendly error messages are essential for the maker audience
- [[storage-error-maps-postgresql-error-codes-to-http-status-giving-routes-structured-error-semantics-without-db-coupling]] — StorageError translates DB→HTTP on the server; error-messages.ts translates HTTP→user on the client — two stages of the same error refinement pipeline
- [[api-key-management-uses-sentinel-values-and-dual-persistence-to-keep-real-keys-invisible-to-the-client]] — "invalid API key" is one of the 6 AI-specific error patterns the mapper handles
- [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini]] — circuit breaker produces the 503 errors that the mapper translates into "AI service temporarily unavailable"

## Topics

- [[index]]
