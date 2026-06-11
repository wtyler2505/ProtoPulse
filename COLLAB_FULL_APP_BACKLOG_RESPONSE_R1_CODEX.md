## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R1.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R1_CODEX.md
- Claimed files: client/src/components/views/PartAlternatesBrowserView.tsx, client/src/components/views/PartAlternatesPanel.tsx, client/src/components/views/__tests__/PartAlternatesBrowserView.test.tsx, client/src/components/views/__tests__/part-alternates-panel.test.tsx, client/src/lib/trust-provenance.ts, client/src/lib/__tests__/trust-provenance.test.ts, client/src/lib/parts/use-part-alternates.ts, client/src/lib/parts/alternate-trust.ts, client/src/lib/parts/__tests__/alternate-trust.test.ts, client/src/lib/parts/index.ts, server/storage/parts.ts, e2e/auth.setup.ts, e2e/e2e-project.ts, e2e/p0-alternates-part-usage-render.spec.ts, .agents/skills/pp-view-alternates/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R1.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R1_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: current Codex turn; one unrelated Claude SDK process observed; Playwright MCP helper processes attached to Codex tooling
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active implementation agents counted from visible process list; Playwright MCP helper processes are tool servers, not implementation workers

# R1 Codex Response

## Read-Only Triage

- The backlog report's Part Alternates section identifies a thin frontend over a stronger alternates graph.
- The standalone browser uses `client/src/components/views/PartAlternatesBrowserView.tsx`.
- The replacement mutation path uses `client/src/components/views/PartAlternatesPanel.tsx` and `useSubstitutePart`.
- `server/storage/parts.ts` currently sorts alternates by `partAlternates.matchScore` but returns only the alternate part row, so the UI cannot display the edge score without a small API shape extension.
- Existing trust primitives are already present: `TrustBadge`, `TrustReceiptCard`, `ReleaseConfidenceCard`, and `ConfidenceBadge`.

## Implementation Decision

Land the lowest-risk useful slice:

- Preserve current query/mutation flow.
- Add `matchScore` to the alternates endpoint payload.
- Map part trust levels to the existing `TrustBadge` kinds.
- Require a preview confirmation before mutation.
- Add focused tests covering browser trust display and mutation gating.

## Implemented

- `server/storage/parts.ts` now includes `partAlternates.matchScore` in `getAlternates()` results instead of dropping the graph edge score.
- `client/src/lib/parts/use-part-alternates.ts` exposes `PartAlternateCandidate` as a part row plus `matchScore`.
- `PartAlternatesBrowserView` now shows source trust, alternate trust, match score, reason text, and tradeoff text.
- `PartAlternatesPanel` now opens a replacement preview before calling `useSubstitutePart()`.
- Added a standalone browser test and expanded the existing panel mutation tests.
- Repaired the Playwright auth fixture so direct workspace smoke tests use a setup-created project instead of assuming project id 1 exists for a fresh user.
- Added `e2e/e2e-project.ts` so E2E specs can read the setup-created project id/name from Playwright storage state and build stable workspace paths.
- Extracted shared Alternates trust/match formatting into `client/src/lib/parts/alternate-trust.ts` and covered it with focused unit tests.
- Pulled the generic trust-level and confidence-percentage helpers into `client/src/lib/trust-provenance.ts`, leaving Alternates-specific reason/tradeoff wording in `alternate-trust.ts`.
- Updated the Alternates skill self-improvement log with the match-score and E2E fixture lessons.

## Verification

- PASS: `npm run test -- client/src/components/views/__tests__/PartAlternatesBrowserView.test.tsx client/src/components/views/__tests__/part-alternates-panel.test.tsx` after fixture repair
- PASS: `npm run test -- client/src/lib/parts/__tests__/alternate-trust.test.ts client/src/components/views/__tests__/PartAlternatesBrowserView.test.tsx client/src/components/views/__tests__/part-alternates-panel.test.tsx`
- PASS: `npm run test -- client/src/lib/__tests__/trust-provenance.test.ts client/src/lib/parts/__tests__/alternate-trust.test.ts client/src/components/views/__tests__/PartAlternatesBrowserView.test.tsx client/src/components/views/__tests__/part-alternates-panel.test.tsx` - 4 files and 15 tests passed.
- PASS: `npm run check`
- PASS: `npm run check:api-types`
- PASS: `npm run page-skills:check && npm run page-skills:audit-packs`
- PASS: `env -u FORCE_COLOR -u NO_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p0-alternates-part-usage-render.spec.ts --reporter=dot` after `auth.setup.ts` seeded a project id; latest run passed 3 Playwright tests in 1.4m.
- PASS with existing warning: `npm run build` exited 0. Current large chunks include `SchematicView` at about 1.28 MB, `extends` at about 0.89 MB, the main `index` chunk at about 0.85 MB, `CodeEditor` at about 0.68 MB, and `react-vendor` at about 0.67 MB.
- DECISION: The Vite large-chunk warning gets its own performance slice, not a blocker for this Alternates R1. It predates this pilot, spans broad route/bundle architecture, and should be handled with real code-splitting/manualChunks work rather than hiding it with `chunkSizeWarningLimit`.

---
ROUND_STATUS: ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Start the Validation safety-gate wave, reusing the Alternates trust/provenance helper pattern.
---
