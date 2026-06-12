---
name: claude-api
description: |
  Build with the Anthropic Messages API (Claude API): model selection, structured outputs, streaming SSE, tool use / function calling, prompt caching, vision, extended thinking, batches, Files API, Managed Agents, and rate limits — with guides for TypeScript, Python, cURL, Go, Java, PHP, Ruby, and C#. Use when: building chatbots/agents/content tools on the raw API, choosing a model ID, or troubleshooting rate_limit_error (429), overloaded_error (529), structured output validation, prompt caching not activating, or streaming SSE parsing.
license: MIT
---

# Claude API — Skill Router

This SKILL.md is a thin router. The real content lives in `shared/` (concepts), the language directories (code), `templates/` (runnable TypeScript), and `references/` (legacy deep dives). Load only what the task needs.

## Hard Rules

1. **Never guess model IDs.** Read `shared/models.md` for the current catalog (aliases, full IDs, retirements). For live capability data (context window, max output, thinking/vision/effort support), query the Models API — the discovery pattern is documented at the top of `shared/models.md`.
2. **Volatile facts (pricing, rate limits, betas, "latest" anything): WebFetch the URL table in `shared/live-sources.md`** instead of trusting cached numbers in this skill.

## Capability Index

| Task | Load |
|------|------|
| Pick a model / resolve a model name | `shared/models.md` |
| Live model capabilities at runtime | `shared/models.md` §Programmatic Model Discovery |
| HTTP/API error codes and handling | `shared/error-codes.md` |
| Prompt caching design (cache_control, TTL, breakpoints) | `shared/prompt-caching.md` |
| Tool use concepts (tool_choice, schemas, results loop) | `shared/tool-use-concepts.md` |
| Agent architecture on the raw API (tool surface, context, cost) | `shared/agent-design.md` |
| Fetch current docs (pricing, limits, betas, new features) | `shared/live-sources.md` |
| Managed Agents (container-backed agent sessions, beta) | `shared/managed-agents-overview.md` → see below |
| Language-specific code | language dirs → see below |
| Runnable TypeScript examples | `templates/` |

## Shared Concept Guides (`shared/`)

- `models.md` — model catalog: current (Opus 4.6, Sonnet 4.6, Haiku 4.5), legacy, deprecated, retired; alias resolution table; Models API discovery pattern
- `error-codes.md` — HTTP error codes, causes, retry guidance
- `prompt-caching.md` — designing prompt-building code for cache hits
- `tool-use-concepts.md` — conceptual foundations of tool use
- `agent-design.md` — decision heuristics for building agents on the API
- `live-sources.md` — WebFetch URL + extraction-prompt table for platform.claude.com docs

### Managed Agents (beta)

- `shared/managed-agents-overview.md` — what it is, when to use it
- `shared/managed-agents-core.md` — agents, sessions, lifecycle
- `shared/managed-agents-api-reference.md` — endpoints and payloads
- `shared/managed-agents-client-patterns.md` — polling, streaming, resumption
- `shared/managed-agents-environments.md` — container/workspace configuration
- `shared/managed-agents-events.md` — event stream reference
- `shared/managed-agents-tools.md` — tool configuration
- `shared/managed-agents-onboarding.md` — first-session walkthrough

## Language Guides

| Language | Messages API | Managed Agents |
|----------|--------------|----------------|
| TypeScript | `typescript/claude-api/` (README, streaming, tool-use, batches, files-api) | `typescript/managed-agents/README.md` |
| Python | `python/claude-api/` (README, streaming, tool-use, batches, files-api) | `python/managed-agents/README.md` |
| cURL / raw HTTP | `curl/examples.md` | `curl/managed-agents.md` |
| Go | `go/claude-api.md` | `go/managed-agents/README.md` |
| Java | `java/claude-api.md` | `java/managed-agents/README.md` |
| PHP | `php/claude-api.md` | `php/managed-agents/README.md` |
| Ruby | `ruby/claude-api.md` | `ruby/managed-agents/README.md` |
| C# | `csharp/claude-api.md` | — |

## Templates (`templates/`)

Runnable TypeScript examples: `basic-chat.ts`, `streaming-chat.ts`, `tool-use-basic.ts`, `tool-use-advanced.ts`, `prompt-caching.ts`, `extended-thinking.ts`, `vision-image.ts`, `error-handling.ts`, `nodejs-example.ts`, `nextjs-api-route.ts`, `cloudflare-worker.ts` (+ `wrangler.jsonc`, `package.json`).

## References (`references/`) — legacy deep dives

`api-reference.md`, `setup-guide.md`, `prompt-caching-guide.md`, `tool-use-patterns.md`, `vision-capabilities.md`, `rate-limits.md`, `top-errors.md`.

**Warning:** these predate the `shared/` + language-dir content. Cross-check any model ID, capability claim, or pricing figure against `shared/models.md` and `shared/live-sources.md` before relying on it. Prefer `shared/` when both cover a topic.

## Error Codes (quick table)

| Status | Error Type | Cause | Solution |
|--------|-----------|-------|----------|
| 400 | invalid_request_error | Bad parameters | Validate request body |
| 401 | authentication_error | Invalid API key | Check env variable |
| 403 | permission_error | No access to feature | Check account tier |
| 404 | not_found_error | Invalid endpoint/model | Check API version + model ID |
| 429 | rate_limit_error | Too many requests | Backoff honoring `retry-after` |
| 500 | api_error | Internal error | Retry with backoff |
| 529 | overloaded_error | System overloaded | Retry later |

Full handling guidance: `shared/error-codes.md`.

## Evergreen Gotchas

- **Streaming errors arrive AFTER the initial 200** — SSE failures happen mid-stream; always attach `error`/`abort` listeners (or try/catch the iterator), never assume a started stream finishes.
- **`cache_control` goes on the LAST block** of the cacheable prefix; monitor `usage.cache_read_input_tokens` / `cache_creation_input_tokens` to confirm hits.
- **`tool_result.tool_use_id` must match the `tool_use` block id**, and tool results go back in a `user`-role message; report tool failures with `is_error: true` rather than swallowing them.
- **On 429, honor the `retry-after` header** before falling back to exponential backoff; watch the `anthropic-ratelimit-*` response headers.
- **Server-side only** — never call the API from browser code; keys belong in server environment variables.
- **Retired models return 404-class errors** — if a request suddenly fails with a model not-found error, check the retirement tables in `shared/models.md`.

## Official Documentation

- Claude API: https://platform.claude.com/docs/en/api
- Messages API: https://platform.claude.com/docs/en/api/messages
- TypeScript SDK: https://github.com/anthropics/anthropic-sdk-typescript
- Context7 Library ID: `/anthropics/anthropic-sdk-typescript`
- Topic-specific URLs (pricing, rate limits, tools, thinking, etc.): `shared/live-sources.md`
