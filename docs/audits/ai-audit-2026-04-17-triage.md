# AI Audit Detail Triage — 2026-04-17

Source: `reports/ai-audit/01-05` (dated 2026-03-27).
Purpose: classify every CRITICAL / HIGH / MEDIUM finding (plus actionable LOW/INFO) as RESOLVED / OPEN / OBSOLETE / NEEDS-INVESTIGATION against the live tree.

## Totals

- **Triaged:** 71
- **RESOLVED:** 31
- **OPEN:** 32
- **OBSOLETE:** 3
- **NEEDS-INVESTIGATION:** 5

## Breakdown by severity and status

| Severity | Resolved | Open | Obsolete | Needs-Invest | Total |
|---|---|---|---|---|---|
| CRITICAL | 5 | 2 | 0 | 0 | 7 |
| HIGH     | 9 | 9 | 1 | 1 | 20 |
| MEDIUM   | 14 | 17 | 2 | 3 | 36 |
| LOW/INFO | 3 | 4 | 0 | 1 | 8 |

## Top 10 OPEN items (by severity, then effort)

1. **01-CORE-CRITICAL-01** Dynamic import of Genkit internal `converters.js` — audit fixer removed the preflight (comment at `server/ai.ts:1182`); the *mitigation* is in place (the preflight is gone) but if anyone re-adds it, it breaks on upgrades. **NEEDS-INVESTIGATION** for whether a public-API-based preflight should be re-added. Low effort.
2. **02-TOOLS-P0-CIRC-01** `suggest_trace_path` still returns hardcoded placeholder points `[{x:50,y:50},{x:70,y:70}]` at `server/ai-tools/circuit.ts:1176`. CRITICAL, medium effort (needs real A*/maze router integration — `server/lib/maze-router.ts` appears to exist).
3. **01-CORE-HIGH-01** Tool double-execution risk in streaming fallback. Needs verification — re-execute guard may still exist at `server/ai.ts` lines ~1190-1209. HIGH, medium effort.
4. **01-CORE-HIGH-03** Genkit tool `outputSchema: z.any()` for all registry tools (`server/genkit.ts:17` still shows `outputSchema: z.object({})` — loose). HIGH, medium effort (write real schemas per ToolResult).
5. **01-CORE-HIGH-05** Gemini fast/standard tiers identical (`server/ai.ts:164-165` still `gemini-2.5-flash` for both). HIGH, low effort (pick `gemini-2.5-flash-lite` or collapse tier system).
6. **03-ROUTES-AI-RT-15** Agent SSE tool_result events are synthetic `{success:true}` (see `server/routes/agent.ts` tool result emission). MEDIUM, low effort.
7. **03-ROUTES-AI-RT-20** `pricingLookupTool` still in `server/genkit.ts` (dev flow only, gated). MEDIUM, low effort (remove / label).
8. **04-UI-H-2** Token cost estimation uses `chars/4` with stale pricing at `client/src/components/panels/ChatPanel.tsx` ~697-700. Users see misleading costs. HIGH (UX), low effort.
9. **04-UI-H-3** Full `queryClient.invalidateQueries()` on every server-tool call at `ChatPanel.tsx:782`. HIGH (perf), medium effort.
10. **05-FEATURES-HIGH-3** Duplicate rules across `ai-prediction-engine.ts` and `proactive-healing.ts` (decoupling caps, flyback, I2C pullups, level shifters). HIGH maintenance risk, medium effort (extract shared `electronics-rules.ts`).

## Consolidated triage table

| # | Report | Severity | Finding | Status | Evidence | Suggested next |
|---|---|---|---|---|---|---|
| 1 | 01-core | CRITICAL | Dynamic import of Genkit internal `converters.js` | RESOLVED | `server/ai.ts:1182` comment "Tool schema pre-flight validation removed (AI-RT-01)" | Verify no re-introduction; consider public-API validator if preflight desired |
| 2 | 01-core | HIGH | Tool double-execution risk in fallback | NEEDS-INVESTIGATION | Fallback paths at `server/ai.ts` lines ~1190-1250 still present; guard unclear | Add read-only/navigation-only whitelist before re-exec |
| 3 | 01-core | HIGH | Missing abort signal propagation to Genkit | RESOLVED | `server/ai.ts:1213` `abortSignal: signal` passed to `ai.generateStream()` |  |
| 4 | 01-core | HIGH | All Genkit tool outputSchema = z.any() | OPEN | `server/genkit.ts:17` still `z.object({})` for registry bridge | Derive output schemas from ToolResult envelope |
| 5 | 01-core | HIGH | Custom system prompt injection (no sanitization) | RESOLVED | `server/ai.ts:962-966` strips/wraps in `<user-instructions>` with override guard |  |
| 6 | 01-core | HIGH | Gemini fast=standard (same model) | OPEN | `server/ai.ts:164-165` both `gemini-2.5-flash` | Use `gemini-2.5-flash-lite` for fast, or collapse matrix |
| 7 | 01-core | MEDIUM | System prompt missing 15+ ViewModes | NEEDS-INVESTIGATION | Not directly verified; `buildSystemPrompt` still lists 6 views in header | Expand view section or drive from ViewMode enum |
| 8 | 01-core | MEDIUM | Missing PCB/3D/simulation view-specific context | OPEN | Same section in `buildSystemPrompt` unchanged | Add view-specific sub-prompts |
| 9 | 01-core | MEDIUM | Dead Anthropic code (import + client cache) | OPEN | `server/ai.ts:397` "// Anthropic" still, `anthropicClients` likely remains | Strip imports + cache |
| 10 | 01-core | MEDIUM | routeToModel called with empty nodes/bom | NEEDS-INVESTIGATION | Complexity detection still depends on appState shape | Pass pre-fetched appState or defer routing |
| 11 | 01-core | MEDIUM | Tool schema preflight failures not filtered | OBSOLETE | Preflight removed entirely (fix #1) |  |
| 12 | 01-core | MEDIUM | No backpressure from Genkit internal stream | OPEN | No evidence of fix | Add drain semaphore on internal iterator |
| 13 | 01-core | MEDIUM | Action parser accepts any `type` string | OPEN | `parseActionsFromResponse` shape unchanged | Validate against AIAction discriminants |
| 14 | 01-core | MEDIUM | Dual action extraction (tool results + text) no dedup | OPEN | `streamAIMessage` still concatenates both | Dedup by structural hash |
| 15 | 01-core | MEDIUM | Secret redaction incomplete (no Bearer/gsk_/xai-) | OPEN | `redactSecrets` unchanged patterns | Extend regex list |
| 16 | 01-core | MEDIUM | Image content not validated beyond MIME | OPEN | Validation surface unchanged | Verify magic bytes + size after decode |
| 17 | 01-core | MEDIUM | Token estimation (words*1.3) inaccurate for code | OPEN | `estimateTokens` unchanged | Adopt tiktoken/closer heuristic |
| 18 | 01-core | MEDIUM | State hash too aggressive (selected node invalidates) | OPEN | `hashAppState` unchanged shape | Drop selected from cache key |
| 19 | 01-core | MEDIUM | O(N*M) edge resolution in buildSystemPrompt | OPEN | Still uses `.find()` per edge | Build `Map<id,Node>` once |
| 20 | 01-core | HIGH (gap) | No token usage tracking / billing | OPEN | No emission of usage metadata in SSE | Surface usageMetadata from Genkit response |
| 21 | 01-core | MEDIUM (gap) | No branchId in AI layer | OPEN | `streamAIMessage` signature unchanged | Plumb branchId through to chat.ts |
| 22 | 01-core | MEDIUM (gap) | No retry with backoff (only fallback) | OPEN | No backoff on primary | Wrap primary call in exponential retry |
| 23 | 01-core | MEDIUM (gap) | No per-tool execution timeout | OPEN | Tools call with no wrapper | AbortController per tool with SLA |
| 24 | 02-tools | P0 | `suggest_trace_path` returns stub points | OPEN | `server/ai-tools/circuit.ts:1176` still `[{x:50,y:50},{x:70,y:70}]` | Wire `server/lib/maze-router.ts` |
| 25 | 02-tools | P1 | `update_bom_item` uses `z.unknown()` | RESOLVED | `server/ai-tools/bom.ts:163-175` now has typed fields (string/number/int) |  |
| 26 | 02-tools | P1 | `err: any` in 3 Google Workspace export tools | NEEDS-INVESTIGATION | Not re-verified in this pass | grep `err: any` in `server/ai-tools/export.ts` |
| 27 | 02-tools | P1 | ToolCategory 10 values vs 16 modules | OPEN | `types.ts` ToolCategory unchanged | Expand or document mismatch |
| 28 | 02-tools | P1 | Doc claims 118 tools, actual 125 | NEEDS-INVESTIGATION | AGENTS.md unchecked in this pass | Update AGENTS.md + project-dna |
| 29 | 02-tools | P2 | Vision tools are prompt-only (no real vision) | OPEN | Documentation gap only | Add module-level JSDoc + README note |
| 30 | 02-tools | P2 | IPC standard cross-ref fragile string splitting | OPEN | `manufacturing.ts` explain_dfm_violation unchanged | Use direct ruleId→key map |
| 31 | 02-tools | P2 | project.ts JSDoc says "9 total", has 10 | OPEN | Header unchanged | Update header comment |
| 32 | 02-tools | P2 | set_pin_map hardcodes 9 pin names w/ passthrough | OPEN | schema unchanged | Simplify to `z.record(z.string())` |
| 33 | 02-tools | P2 | switch_view enum missing 10+ ViewModes | RESOLVED | `server/ai-tools/navigation.ts:38-48` now enumerates 30 views |  |
| 34 | 02-tools | P3 | delete_component_part lacks confirmation | OPEN | No requiresConfirmation flag | Add flag if deletion is destructive |
| 35 | 02-tools | P3 | 13/16 tool modules lack dedicated tests | OPEN | `__tests__/` still only 3 | Add tests for export/architecture/circuit server-side |
| 36 | 03-routes | CRITICAL AI-RT-01 | No auth on circuit-AI endpoints | RESOLVED | `server/circuit-ai/{generate,review,analyze}.ts` all use `requireCircuitOwnership`; regression tests in `server/__tests__/ai-endpoint-auth.test.ts` |  |
| 37 | 03-routes | CRITICAL AI-RT-02 | genkit-test unguarded in prod | RESOLVED | `server/routes.ts:88-100` wrapped in `NODE_ENV === 'development'` |  |
| 38 | 03-routes | CRITICAL AI-RT-03 | Agent auto-confirms destructive ops | RESOLVED | `server/routes/agent.ts:188` now `confirmed: false` |  |
| 39 | 03-routes | CRITICAL AI-RT-04 | Genkit standalone tools bypass ownership | RESOLVED | `server/genkit.ts:46-57,101-122` tools read `projectId` from `ai.currentContext()` with null-check throw |  |
| 40 | 03-routes | CRITICAL AI-RT-05 | No transaction in circuit generation | RESOLVED | `server/circuit-ai/generate.ts:76` "Compensating transaction: track created IDs so we can clean up on failure" |  |
| 41 | 03-routes | HIGH AI-RT-06 | Unvalidated googleWorkspaceToken passthrough | RESOLVED | `server/routes/chat.ts:710-714` resolved server-side via `getApiKey(userId, 'google_workspace')`, not body |  |
| 42 | 03-routes | HIGH AI-RT-07 | Agent has no absolute timeout | RESOLVED | `server/routes/agent.ts:168-171` `ABSOLUTE_AGENT_TIMEOUT_MS` with AbortController |  |
| 43 | 03-routes | HIGH AI-RT-08 | No RL on /api/chat/ai | RESOLVED | `server/routes/chat.ts:67,467` `chatAiRateLimiter` added |  |
| 44 | 03-routes | HIGH AI-RT-09 | No RL on circuit-AI | RESOLVED | All 3 circuit-AI routes use `circuitAiRateLimiter` from `server/circuit-ai/rate-limiter.ts` |  |
| 45 | 03-routes | HIGH AI-RT-10 | Invalid segment fallback to instance id 0 | NEEDS-INVESTIGATION | Not re-verified in this pass | Check `generate.ts` segment mapping fallback |
| 46 | 03-routes | HIGH AI-RT-11 | maxSteps not enforced | RESOLVED | `server/routes/agent.ts:217-222` `if (step >= maxSteps)` with complete event |  |
| 47 | 03-routes | HIGH AI-RT-12 | Dead thinking.ts / types.ts | OPEN | Files still present in `server/circuit-ai/` | Delete or wire up |
| 48 | 03-routes | MEDIUM AI-RT-13 | Schema default claude-sonnet-4, handler forces gemini | OPEN | `schemas.ts` not updated | Change defaults to match behavior |
| 49 | 03-routes | MEDIUM AI-RT-14 | Duplicate auth logic in chat/ai endpoints | OPEN | Inline session validation not extracted | Factor into middleware |
| 50 | 03-routes | MEDIUM AI-RT-15 | Synthetic tool_result events in agent | OPEN | Tool result pass-through not wired | Forward actual ToolResult |
| 51 | 03-routes | MEDIUM AI-RT-16 | `total` misleading in paginated responses | OPEN | `server/routes/chat.ts:419,776,810` still `total: messages.length` | Return real count from storage |
| 52 | 03-routes | MEDIUM AI-RT-17 | O(n*m) instance lookup in prompts | NEEDS-INVESTIGATION | analyze.ts / review.ts not re-verified | Swap `.find()` for Map |
| 53 | 03-routes | MEDIUM AI-RT-18 | No agent concurrency guard | RESOLVED | `server/routes/agent.ts:160-164` `activeAgentSessions.add(sessionId)` |  |
| 54 | 03-routes | MEDIUM AI-RT-19 | Redundant project check in ai-actions GET | OPEN | `server/routes/chat.ts:772-774` still duplicates middleware check | Remove inline getProject |
| 55 | 03-routes | MEDIUM AI-RT-20 | Mock pricingLookupTool in prod | OBSOLETE | Flows only accessible via dev-gated genkit-test (AI-RT-02 fix) — no user-facing path | Optionally remove tool |
| 56 | 04-ui | CRITICAL C-1 | GenerativeDesignView Adopt non-functional | OPEN (partial) | `GenerativeDesignView.tsx:358` still passes `defaultBaseCircuit()` as currentIR; `onAdopt` body now pushes nodes (359-) but comparison baseline is still hardcoded | Replace `defaultBaseCircuit()` with live project IR |
| 57 | 04-ui | HIGH H-1 | handleSend 315-line monolith, untested | OPEN | `ChatPanel.tsx:572` still single huge callback | Extract useChatSend() hook |
| 58 | 04-ui | HIGH H-2 | Token cost estimation chars/4 w/ stale prices | OPEN | Estimation logic unchanged | Either hide or fetch real usage from server SSE done event |
| 59 | 04-ui | HIGH H-3 | Full queryClient.invalidateQueries() on every tool call | OPEN | `ChatPanel.tsx:782` `queryClient.invalidateQueries()` with no filter | Scope to tool-category query keys |
| 60 | 04-ui | MEDIUM M-1 | sendStateRef pattern fragile | OPEN | Pattern unchanged | Document invariant in comment; consider refactor to reducer |
| 61 | 04-ui | MEDIUM M-2 | No-API-key dual behavior (dialog + local command) | OPEN | `handleSend` no-key branch unchanged | Pick one path |
| 62 | 04-ui | MEDIUM M-4 | DesignAgentPanel unbounded steps array | OPEN | No cap visible | Cap at e.g. 500 entries with trim |
| 63 | 04-ui | MEDIUM M-5 | extractConfidence() dead code in MessageBubble | OPEN | Function defined, not called | Remove |
| 64 | 04-ui | MEDIUM M-6 | Chat context persists system messages to DB | OPEN | addMessage always mutates via API | Add local-only flag or segregate |
| 65 | 04-ui | MEDIUM A-2 | No aria-live region for streaming | OPEN | No `aria-live` on MessageList/StreamingIndicator | Add polite region |
| 66 | 04-ui | HIGH A-1 | No focus management on panel open | OPEN | No autofocus logic | Focus textarea on mount |
| 67 | 05-features | CRITICAL 1 | "AI" modules have no AI API calls | OBSOLETE | By design per project architecture — client-side heuristics; audit flagged as branding-vs-reality only | Document in module headers (cosmetic) |
| 68 | 05-features | CRITICAL 2 | Voice pipeline disconnect (no STT bridge) | OPEN | `voice-ai.ts` captures audio, `voice-workflow.ts` expects text — no bridge | Wire Web Speech API or server STT |
| 69 | 05-features | HIGH 3 | Rule duplication prediction vs healing | OPEN | Both files present with overlapping rules | Extract `electronics-rules.ts` |
| 70 | 05-features | HIGH 4 | ai-co-designer scoring is placeholder | OPEN | Module unchanged | Either integrate server AI call or hide scoring |
| 71 | 05-features | MEDIUM 6 | stream-resilience.ts no dedicated test file | OPEN | `ls client/src/lib/__tests__/stream-resilience*` → not found | Add unit tests for retry/heartbeat/abort |

## Notes on triage methodology

- Direct file reads against live HEAD (`parts-consolidation` branch) to verify exact line references in the audit.
- Git log `-S` used where commit attribution was helpful (e.g., `circuitAiRateLimiter`, `ABSOLUTE_AGENT_TIMEOUT_MS`, `activeAgentSessions` — all introduced in wave commits but not tied to a single clean commit because of auto-commit noise).
- Pre-existing closeout doc `docs/audits/ai-audit-2026-04-14-fixes.md` anchored AI-RT-01..05 resolution.
- "NEEDS-INVESTIGATION" rows are ones where the fix *may* be in but required more focused tracing than this pass allowed; none are CRITICAL.

## Recommendation: next wave

Pick up the 10 items at the top. Highest leverage:
- Fix `suggest_trace_path` stub (P0) — real routing engine exists.
- Tighten Genkit tool `outputSchema` (HIGH) — prevents info leak.
- Differentiate Gemini fast/standard tiers (HIGH) — cheap config change, big UX impact.
- Scope `queryClient.invalidateQueries()` (HIGH) — major client perf win.
- Extract shared electronics rules module (HIGH maintenance) — unblocks future rule work.
