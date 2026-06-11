## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R55.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R55_CODEX.md
- Claimed files:
  - client/src/components/views/ValidationView.tsx
  - client/src/components/views/__tests__/ValidationView.test.tsx
  - client/src/components/views/validation/BomCompletenessSection.tsx
  - client/src/components/views/validation/CustomRulesDialog.tsx
  - client/src/components/views/validation/DesignGatewaySection.tsx
  - client/src/components/views/validation/DfmCheckSection.tsx
  - client/src/components/views/validation/VirtualizedIssueList.tsx
  - client/src/components/views/validation/validation-helpers.ts
  - client/src/lib/export-validation.ts
  - client/src/lib/export-precheck.ts
  - client/src/lib/validation-safety-gates.ts
  - client/src/lib/__tests__/export-validation.test.ts
  - client/src/lib/__tests__/export-precheck.test.ts
  - client/src/lib/__tests__/validation-safety-gates.test.ts
  - client/src/components/ui/TrustBadge.tsx
  - client/src/components/ui/__tests__/TrustBadge.test.tsx
  - e2e/p1-validation-safety-gates.spec.ts
- Forbidden files:
  - CODEX_HANDOFF.md
  - CODEX_DONE.md
  - unrelated existing COLLAB_*
  - .env
  - knowledge/**
  - data/pp-nlm/**
- Background sessions: none; no npm/vitest/dev-server sessions running at lane open
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible process list; current Codex session plus one Claude session, with MCP helper processes)

## Target

Continue the full-app backlog campaign by turning Validation into the first explicit provenance safety gate after the shared UI/status primitives landed in R54.

## Scope

- Preserve the existing dirty Validation work and harden it instead of overwriting it.
- Surface AI-generated origin, exact-part verification, mechanical/3D model readiness, breadboard health, lifecycle risk, and inventory confidence in Validation summaries and issue rows.
- Keep Validation usable at laptop height with scrollable sections and compact controls.
- Reuse shared trust/status primitives where practical.
- Cover browser and pure validation paths with focused tests.

## Current Evidence

- Context7: React docs confirmed deriving display state during render/useMemo is preferred over redundant effects.
- Context7: Playwright docs confirmed locator/web-first assertions and viewport checks are the right verification shape.
- Context7: Tailwind lookup failed with `fetch failed`; official Tailwind spacing docs confirm numeric spacing utilities use `calc(var(--spacing) * <number>)`, so the Tailwind v4 fractional spacing classes in the dirty draft are valid.
- Dirty-file inspection found the current Validation draft already adds:
  - provenance gate fields to `ProjectExportData`
  - structured safety checks in `export-precheck`
  - `buildValidationSafetyGateData`
  - `ValidationSafetyGateSection`
  - `VirtualizedIssueList` safety-gate rows
  - focused unit tests for precheck/export/view behavior

## Implementation Notes

- Do not expand this slice into Breadboard/Digital Twin/3D work. This is the safety-gate bridge needed before money gates and canvas surfaces consume the trust output.
- Treat TypeScript, runtime, React, a11y, and test warnings as defects.
- If existing dirty files contain broken draft work, repair in place and document the fix in the R55 response.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: Tailwind v4 spacing docs fallback still pending; focused verification not yet run
SIGNOFF: Codex
OWNERSHIP: Codex — harden Validation provenance gate and verify
NEXT_ROUND: Implement/verify R55 and write COLLAB_FULL_APP_BACKLOG_RESPONSE_R55_CODEX.md
---
