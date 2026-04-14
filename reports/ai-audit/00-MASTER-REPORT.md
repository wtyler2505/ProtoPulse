# ProtoPulse AI System — Master Audit Report

> **Date:** 2026-03-27
> **Auditors:** 5-agent team (ai-core, ai-tools, ai-routes, ai-client-ui, ai-features)
> **Scope:** Every line of code related to the in-app AI system
> **Total code analyzed:** ~26,000+ lines across 80+ files
> **Individual reports:** `01-server-ai-core.md` through `05-client-ai-features.md`

---

## Executive Summary

ProtoPulse's AI system is architecturally ambitious — 125 server-side tools, a streaming Genkit-to-Gemini pipeline, a decomposed chat UI, and 30 client-side "AI" feature libraries. The breadth is impressive, but this audit uncovered **7 CRITICAL**, **19 HIGH**, **27 MEDIUM**, and **16 LOW** issues across the stack.

**The three biggest systemic problems:**

1. **Security gaps in AI endpoints** — 3 circuit-AI endpoints and the genkit-test route have ZERO authentication. The agent endpoint auto-confirms destructive operations. Genkit standalone tools accept model-controlled `projectId` with no ownership check, enabling cross-tenant data exfiltration.

2. **The "AI" feature libraries aren't AI** — All 30 client-side modules branded as "AI" (prediction engine, root cause analyzer, tutor, co-designer, etc.) are purely client-side heuristic engines with hardcoded knowledge bases. None call any AI API. This creates a gap between user expectations and reality.

3. **Fragile Genkit integration** — Dynamic import of internal Genkit module paths, tool double-execution risk in streaming fallback, `z.any()` output schemas, and stale model IDs throughout.

---

## Findings Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| **CRITICAL** | 7 | Zero auth on AI endpoints, cross-tenant data exfiltration, agent auto-confirms destructive ops, no transaction wrapping, internal module import |
| **HIGH** | 19 | Tool double-execution, missing abort signal, dead Anthropic code, weak typing, missing rate limits, broken GenerativeDesign adopt |
| **MEDIUM** | 27 | Stale docs (118→125 tools), incomplete view awareness, duplicate auth logic, mock pricing in prod, vision tools are prompt-only |
| **LOW** | 16 | Inconsistent patterns, dead code, hardcoded defaults, copy-paste log messages |
| **INFO** | 8+ | Architecture notes, stale comments, deprecated model IDs |

---

## CRITICAL Findings (7)

> **2026-04-14 update:** AI-RT-01 through AI-RT-05 were resolved in commit `e199faad`
> (2026-03-27, *"Fix 5 P0 security issues from AI deep audit"*). Regression tests for
> AI-RT-01 and AI-RT-02 added in `server/__tests__/ai-endpoint-auth.test.ts` on 2026-04-14.
> See `docs/audits/ai-audit-2026-04-14-fixes.md` for evidence. AI-RT-03 and AI-RT-04 still
> need regression tests; CORE-01 and TOOLS-01 remain open.

| ID | Source | Finding | Impact | Status |
|----|--------|---------|--------|--------|
| AI-RT-01 | Routes | **Zero auth on circuit-AI endpoints** (`/api/circuits/:circuitId/ai/generate\|review\|analyze`) | Any user can access any circuit. IDOR/BOLA vulnerability. | **RESOLVED** `e199faad` + tests 2026-04-14 |
| AI-RT-02 | Routes | **`/api/genkit-test` exposed in production** with no auth, no validation, no rate limit | Direct Gemini API access at operator's expense. | **RESOLVED** `e199faad` + tests 2026-04-14 |
| AI-RT-03 | Routes | **Agent auto-confirms destructive operations** — hardcodes `confirmed: true` | Destructive tools (delete nodes, clear BOM) execute without user consent in agent mode. | **RESOLVED** `e199faad` (needs regression test) |
| AI-RT-04 | Routes | **Genkit tools bypass ownership** — `queryBomItemsTool`, `queryNodesTool`, `queryEdgesTool` accept model-controlled `projectId` | Cross-tenant data exfiltration via prompt injection. | **RESOLVED** `e199faad` (needs regression test) |
| AI-RT-05 | Routes | **No transaction in circuit generation** — instances/nets/wires created without wrapping | Partial failures leave orphaned/corrupt data. | **RESOLVED** `e199faad` (compensating txn) |
| CORE-01 | Core | **Dynamic import of internal Genkit module** (`../node_modules/@genkit-ai/google-genai/lib/common/converters.js`) | Will break on any Genkit upgrade. | Open |
| TOOLS-01 | Tools | **`suggest_trace_path` returns hardcoded stub** `[{x:50,y:50},{x:70,y:70}]` | Tool appears functional but returns fake data. | Open |

---

## HIGH Findings (19)

| ID | Source | Finding |
|----|--------|---------|
| CORE-02 | Core | **Tool double-execution risk** — streaming fallback re-executes tools Genkit already ran, causing duplicate DB writes |
| CORE-03 | Core | **Missing abort signal** to Genkit `generateStream` — cancelled requests still consume API quota |
| CORE-04 | Core | **All Genkit tool output schemas are `z.any()`** — no output validation, potential info leakage |
| CORE-05 | Core | **Custom system prompt injection** — users inject arbitrary instructions without sanitization |
| CORE-06 | Core | **Gemini fast/standard tiers identical** (`gemini-2.5-flash` for both) — routing matrix partially ineffective |
| AI-RT-06 | Routes | **Unvalidated `googleWorkspaceToken`** bypasses Zod schema, raw user input passed to Google API |
| AI-RT-07 | Routes | **Agent has no absolute timeout** — stuck loop holds connection indefinitely |
| AI-RT-08 | Routes | **No rate limiting on non-streaming AI** (`/api/chat/ai`) |
| AI-RT-09 | Routes | **No rate limiting on circuit-AI endpoints** |
| AI-RT-10 | Routes | **Invalid segment fallback to 0** — creates invalid DB records when ref des not found |
| AI-RT-11 | Routes | **`maxSteps` not enforced** in agent — parsed but never checked |
| AI-RT-12 | Routes | **Dead code: `thinking.ts` + `types.ts`** — Anthropic thinking config never called |
| TOOLS-02 | Tools | **Weak typing in `update_bom_item`** — uses `z.unknown().optional()` for all fields |
| TOOLS-03 | Tools | **`err: any` in export error handlers** — violates `no-explicit-any` rule |
| TOOLS-04 | Tools | **`ToolCategory` type incomplete** — 10 values for 16 modules |
| TOOLS-05 | Tools | **Tool count docs stale** — "118 AI tools" everywhere, actual is 125 |
| UI-01 | Client UI | **GenerativeDesignView Adopt is non-functional** — no-op callback, hardcoded seed circuit |
| UI-02 | Client UI | **`handleSend` is 315-line untested monolith** — zero test coverage for core chat flow |
| UI-03 | Client UI | **Token cost uses hardcoded inaccurate pricing** |
| FEAT-01 | Features | **None of the 30 "AI" modules call any AI API** — purely heuristic engines with ~500 hardcoded items |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT (React 19)                          │
│                                                                 │
│  ChatPanel.tsx (1206 lines)                                     │
│    ├── 14 sub-components (MessageBubble, Input, Settings, etc.) │
│    ├── 4 custom hooks (UI state, messaging, multimodal, action) │
│    └── ChatContext (React Query + branches)                     │
│                                                                 │
│  30 "AI" Feature Libraries (~14,000 lines)                      │
│    ├── ai-prediction-engine (1387 lines, 32 rules)              │
│    ├── ai-root-cause (1005 lines, 22 symptoms, 20 patterns)     │
│    ├── ai-review-queue (480 lines, threshold-based routing)     │
│    ├── voice-workflow, multimodal-input, generative-design      │
│    └── ... 24 more modules (all client-side heuristics)         │
│                                                                 │
│  DesignAgentPanel (327 lines) — multi-turn agentic UI           │
│  GenerativeDesignView (363 lines) — evolutionary design         │
│  ConfidenceBadge, ActionErrorBanner, CameraComponentId          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    SSE / REST API calls
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Express 5)                         │
│                                                                 │
│  routes/chat.ts (743 lines)                                     │
│    ├── CRUD endpoints (GET/POST/DELETE chat messages)            │
│    ├── POST /api/chat/ai (non-streaming, processAIMessage)      │
│    ├── POST /api/chat/ai/stream (SSE, streamAIMessage)          │
│    │   └── Comprehensive abuse protection (rate limit,          │
│    │       concurrency, body size, origin, timeout, heartbeat)  │
│    └── buildAppStateFromProject() — O(N) query fan-out          │
│                                                                 │
│  routes/agent.ts (236 lines)                                    │
│    └── POST /api/projects/:id/agent (SSE agentic loop)          │
│        ⚠ auto-confirms destructive ops, no timeout              │
│                                                                 │
│  circuit-ai/ (4 files)                                          │
│    ├── generate.ts — schematic generation from description      │
│    ├── review.ts — schematic review for issues                  │
│    ├── analyze.ts — circuit analysis (what-if, topology)        │
│    └── ⚠ ALL 3 endpoints: ZERO AUTH, ZERO RATE LIMIT           │
│                                                                 │
│  ai.ts (1317 lines) — Central AI orchestration                  │
│    ├── buildSystemPrompt() — project state → prompt             │
│    ├── routeToModel() — phase-aware model selection              │
│    ├── streamAIMessage() → genkit.ts → Gemini API              │
│    ├── parseActionsFromResponse() — legacy JSON extraction      │
│    └── Error categorization, secret redaction, token mgmt       │
│                                                                 │
│  ai-tools/ (20 files, ~8700 lines, 125 tools)                   │
│    ├── architecture (22), circuit (21), export (17), bom (12)   │
│    ├── validation (11), project (10), component (6), sim (5)    │
│    ├── arduino (5), manufacturing (3), testbench (3)            │
│    ├── bom-opt (3), vision (2), generative (2), nav (2)         │
│    └── risk-analysis (1)                                        │
│    ⚡ ~48 server-side, ~77 client-dispatched                    │
│                                                                 │
│  genkit.ts (169 lines) — Genkit SDK bridge                      │
│    ├── Converts ToolRegistry → Genkit tools                     │
│    ├── 4 standalone flows (POC, stale model IDs)                │
│    └── ⚠ Mock pricing tool, hardcoded projectId: 1             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tool Inventory Summary

**125 tools total** across 16 modules:

| Module | Tools | Execution Split | Notable |
|--------|-------|----------------|---------|
| architecture.ts | 22 | 3 server / 19 client | Largest tool count |
| circuit.ts | 21 | 5 server / 16 client | Largest file (1470 lines) |
| export.ts | 17 | 17 server | All server-side (real exports) |
| bom.ts | 12 | 3 server / 9 client | `update_bom_item` has weak typing |
| validation.ts | 11 | 11 client | All client-dispatched |
| project.ts | 10 | 1 server / 9 client | Header says "9" but has 10 |
| component.ts | 6 | 1 server / 5 client | `delete_component_part` lacks confirmation |
| simulation.ts | 5 | 5 client | All client-dispatched |
| arduino.ts | 5 | 5 client | Thin wrappers |
| manufacturing.ts | 3 | 3 client | 1062 lines (354 lines/tool!) |
| bom-optimization.ts | 3 | 3 client | 665 lines, heavy analysis |
| testbench.ts | 3 | 3 client | 578 lines |
| generative.ts | 2 | 2 client | Evolutionary design |
| vision.ts | 2 | 2 client | Prompt-only (no real vision) |
| navigation.ts | 2 | 2 client | `switch_view` only has 6 of 15+ views |
| risk-analysis.ts | 1 | 1 client | Single tool |

**6 destructive tools** (require confirmation): `delete_architecture_node`, `clear_architecture`, `delete_bom_item`, `clear_bom`, `reset_circuit_design`, `delete_component_part` (missing flag).

**Coverage gaps** (no AI tools for): Collaboration, design history/snapshots, PCB ordering, keyboard shortcuts, standards compliance, assembly cost estimation, thermal/PDN analysis, differential pair routing.

---

## Client AI Features Reality Check

**CRITICAL finding:** All 30 client-side "AI" modules are deterministic engines. None make API calls.

| Module | Lines | What It Actually Is |
|--------|-------|-------------------|
| ai-prediction-engine | 1387 | 32 hardcoded rules, keyword pattern matching |
| ai-root-cause | 1005 | 22 symptoms + 20 failure patterns, BFS causal graph |
| ai-review-queue | 480 | Threshold-based action routing (auto-approve/review/dismiss) |
| ai-safety-mode | ~300 | Risk scoring with hardcoded weights |
| ai-tutor | ~400 | Guided explanations with canned content |
| ai-co-designer | ~350 | Design suggestion engine with static rule base |
| ai-goal-parser | ~250 | Regex-based natural language parsing |
| voice-workflow | ~500 | Web Speech API → text → action mapping |
| voice-ai | ~300 | Voice command recognition (keyword matching) |
| multimodal-input | ~400 | Image/file preprocessing pipeline |
| generative-engine | ~600 | Evolutionary algorithm (crossover/mutation/selection) |
| rag-engine | ~400 | TF-IDF keyword search (not vector embeddings) |
| smart-library-installer | ~350 | Component suggestion based on adjacency |
| board-aware-suggestions | ~300 | Board-specific tip generator |
| stream-resilience | ~250 | SSE reconnection with exponential backoff |
| ... | ... | All follow the same pattern |

**Total: ~14,000 lines of client code branded "AI" that is actually algorithmic/heuristic.**

---

## Recommended Fix Priority

### P0 — Must Fix Immediately (Security)

1. **Add `requireCircuitOwnership` to circuit-AI endpoints** (AI-RT-01)
   - Files: `server/circuit-ai/analyze.ts`, `generate.ts`, `review.ts`
   - Middleware exists — just wire it up

2. **Remove or dev-gate `/api/genkit-test`** (AI-RT-02)
   - File: `server/routes.ts:83`
   - Wrap in `if (process.env.NODE_ENV === 'development')`

3. **Remove `confirmed: true` from agent tool context** (AI-RT-03)
   - File: `server/routes/agent.ts:145`
   - Either require explicit confirmation or restrict agent to non-destructive tools

4. **Add ownership validation to Genkit standalone tools** (AI-RT-04)
   - File: `server/genkit.ts:30-107`
   - Pass `projectId` from route context, not from model input

5. **Wrap circuit generation in database transaction** (AI-RT-05)
   - File: `server/circuit-ai/generate.ts:111-153`

### P1 — Should Fix Soon (Reliability + Quality)

6. **Replace internal Genkit module import** with public API or vendored function (CORE-01)
7. **Guard against tool double-execution** in streaming fallback (CORE-02)
8. **Pass abort signal to Genkit `generateStream`** (CORE-03)
9. **Add proper output schemas** to replace `z.any()` (CORE-04)
10. **Add rate limiting** to `/api/chat/ai` and circuit-AI endpoints (AI-RT-08, AI-RT-09)
11. **Add absolute timeout** to agent endpoint (AI-RT-07)
12. **Enforce `maxSteps`** in agent loop (AI-RT-11)
13. **Fix GenerativeDesignView adopt** — wire up real callback (UI-01)
14. **Add tests for `handleSend`** core chat flow (UI-02)
15. **Update tool count** in docs from "118" to "125" (TOOLS-05)

### P2 — Should Fix (Polish + Completeness)

16. **Update system prompt** to document all 15+ ViewModes (CORE, MEDIUM)
17. **Clean up dead Anthropic code** — imports, client cache, model tiers
18. **Fix Gemini tier duplication** — differentiate fast vs standard
19. **Remove mock pricing tool** from genkit.ts
20. **Remove dead code** — thinking.ts, types.ts, unused constants
21. **Add missing ViewModes** to `switch_view` tool enum
22. **Fix `update_bom_item` typing** — replace `z.unknown()` with proper schemas
23. **Sanitize custom system prompt** input
24. **Add tool coverage** for collaboration, design history, PCB ordering
25. **Optimize edge resolution** in buildSystemPrompt (O(N*M) → O(N))

### P3 — Nice to Have (Long-term)

26. Consider adding real AI API calls behind the client feature interfaces
27. Replace TF-IDF in RAG engine with vector embeddings
28. Migrate `ScriptProcessorNode` to `AudioWorklet` in voice-ai
29. Add token usage tracking/analytics
30. Modularize system prompt builder into separate testable file
31. Consolidate 30 scattered singletons into unified AI services layer

---

## Positive Findings

The audit isn't all problems. Notable strengths:

- **Stream abuse protection is excellent** — rate limiting, concurrency guards, body size limits, origin validation, timeouts, heartbeat, backpressure handling
- **Chat CRUD consistently uses ownership middleware** — well-secured
- **Error handling in ai.ts is thorough** — 6 error categories, secret redaction, user-friendly messages
- **Tool confirmation system is well-designed** — 6 destructive tools flagged, server-side enforcement
- **ChatPanel decomposition is solid** — 14 sub-components + 4 hooks from what was a monolith
- **Client feature libraries are well-tested** — 29/30 have dedicated test files
- **Token-aware history truncation** prevents context overflow
- **View-aware prompt optimization** reduces prompt size for non-active views
- **Prompt caching and client instance caching** reduce redundant work

---

## Report Files

| # | File | Lines | Scope |
|---|------|-------|-------|
| 01 | `01-server-ai-core.md` | 469 | server/ai.ts deep dive |
| 02 | `02-server-ai-tools.md` | 610 | server/ai-tools/ (125 tools, 20 files) |
| 03 | `03-server-ai-routes.md` | 692 | routes/chat.ts, agent.ts, circuit-ai/ |
| 04 | `04-client-ai-ui.md` | 618 | ChatPanel, DesignAgent, hooks, components |
| 05 | `05-client-ai-features.md` | 847 | 30 client AI feature libraries |
| 00 | `00-MASTER-REPORT.md` | this file | Synthesized master report |
