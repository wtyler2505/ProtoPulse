# AI Audit — CRITICAL Auth Findings Resolution (2026-04-14)

> Audit source: `reports/ai-audit/00-MASTER-REPORT.md` (dated 2026-03-27)
> Fixes landed: commit `e199faad` (2026-03-27) — *"Fix 5 P0 security issues from AI deep audit"*
> Regression tests added: 2026-04-14

## Summary

The CRITICAL auth findings in the AI audit (AI-RT-01, AI-RT-02) were **already resolved** on
2026-03-27 in commit `e199faad`. The master report had not been updated to reflect the fix,
making the audit stale on these items. This doc closes the loop and locks in the fix with
regression tests.

Two additional CRITICAL items flagged in the audit (AI-RT-03, AI-RT-04) were also closed by
the same commit but are out of scope for this pass and will be verified/tested separately.

## Resolved CRITICAL items

### AI-RT-01 — Zero auth on circuit-AI endpoints — **RESOLVED**

**Audit claim:** `POST /api/circuits/:circuitId/ai/{generate,review,analyze}` had no auth.

**Reality (evidence):**

| Endpoint | File:Line | Middleware |
|---|---|---|
| `POST /api/circuits/:circuitId/ai/generate` | `server/circuit-ai/generate.ts:20-24` | `requireCircuitOwnership, circuitAiRateLimiter, payloadLimit(...)` |
| `POST /api/circuits/:circuitId/ai/review`   | `server/circuit-ai/review.ts:96-100`  | `requireCircuitOwnership, circuitAiRateLimiter, payloadLimit(...)` |
| `POST /api/circuits/:circuitId/ai/analyze`  | `server/circuit-ai/analyze.ts:92-96`  | `requireCircuitOwnership, circuitAiRateLimiter, payloadLimit(...)` |

`requireCircuitOwnership` (in `server/routes/auth-middleware.ts:83-131`) enforces both:

- **Auth gate** — 401 if no `X-Session-Id` header or invalid/expired session.
- **Ownership gate** — 404 (OWASP-style enumeration protection) if the caller is not the
  project owner.

### AI-RT-02 — `/api/genkit-test` exposed in production — **RESOLVED**

**Audit claim:** `/api/genkit-test` was registered without auth in all environments.

**Reality (evidence):** `server/routes.ts:88-100` wraps the registration in
`if (process.env.NODE_ENV === 'development')`, so the route is not registered at all in
staging/production builds.

## Regression tests

New file: `server/__tests__/ai-endpoint-auth.test.ts` (16 tests, all green).

Coverage:

1. **Static source guards** — each of the three circuit-AI route files imports
   `requireCircuitOwnership` from the auth-middleware module and wires it into the matching
   `app.post('/api/circuits/:circuitId/ai/…', …)` call. Prevents accidental removal.
2. **Middleware behavior on circuits** — unauthenticated → 401, invalid session → 401,
   missing circuit → 404, missing project → 404, non-owner → 404 (enumeration-safe), valid
   owner → pass-through, owner-less project (ownerId=null) → pass-through (backward compat).
3. **Dev-gate** — static check that `/api/genkit-test` is declared exactly once in
   `server/routes.ts` and lives inside an `if (process.env.NODE_ENV === 'development')`
   block.

## Scope boundary (WS-01 coordination)

This pass handled the **AUTH gate** only — i.e. "is a session present and valid?". Ownership
correctness (i.e. "does this specific user own this specific resource?") is being hardened
in parallel by agent WS-01 and by the broader `ownership-integration.test.ts` suite.

The happy-path + wrong-owner ownership cases are covered here at a coarse level to guard
against regressions in the circuit → project → owner resolution path specifically, not as a
substitute for WS-01's work.

## Remaining CRITICAL items from AI audit (not addressed here)

| ID | Status | Owner / Notes |
|----|--------|---------------|
| AI-RT-03 | Resolved in `e199faad`, needs regression test | Agent changed `confirmed: true` → `confirmed: false` at `server/routes/agent.ts:188`. |
| AI-RT-04 | Resolved in `e199faad`, needs regression test | Genkit standalone tools now read `projectId` from execution context, not model input (`server/genkit.ts`). |
| AI-RT-05 | Resolved in `e199faad` | Circuit generation now uses compensating transaction with cleanup. |
| CORE-01  | Open | Dynamic import of internal Genkit module path. Pending vendoring or upgrade. |
| TOOLS-01 | Open | `suggest_trace_path` returns hardcoded stub. |

Agents WS-02/WS-03 should pick up AI-RT-03/04 regression tests and CORE-01/TOOLS-01 fixes.
