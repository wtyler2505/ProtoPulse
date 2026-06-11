## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R6.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R6_CODEX.md
- Claimed files: client/src/lib/export-precheck.ts, client/src/lib/__tests__/export-precheck.test.ts, client/src/components/views/BomTemplatesPanel.tsx, client/src/components/views/__tests__/BomTemplatesPanel.test.tsx, .agents/skills/pp-view-bom-templates/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R6.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R6_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R6 Codex Response

## Implementation Summary

Implemented the BOM Templates money/action safety gate.

- Added shared trust checks to `export-precheck` for AI-generated provenance, exact-part verification, verified mechanical models, breadboard health, lifecycle risk, and inventory confidence.
- Added a `bom-template-apply` precheck profile that intentionally does not require an existing BOM, PCB layout, or circuit instances.
- Wired `BomTemplatesPanel` to Validation safety-gate data from circuit instances, component parts, project metadata, architecture, and BOM context.
- Added a visible Template Safety Gate with trust badges, blocker/warning details, blocked Save/Apply behavior, and a warning-only preview before the apply mutation.
- Added focused panel tests for lifecycle blockers and warning-only preview/confirm behavior.
- Updated the BOM Templates skill self-improvement log with the durable R6 lesson.

## Evidence

- `client/src/lib/export-precheck.ts:160` adds trust/provenance check builders used by money/release flows.
- `client/src/lib/export-precheck.ts:399` registers `bom-template-apply` with the trust gate but without BOM/layout/circuit hard requirements.
- `client/src/components/views/BomTemplatesPanel.tsx:146` renders the Template Safety Gate summary and per-check details.
- `client/src/components/views/BomTemplatesPanel.tsx:197` adds the preview/confirm step before template apply mutation.
- `client/src/components/views/BomTemplatesPanel.tsx:271` builds Validation safety-gate data and runs the `bom-template-apply` precheck.
- `client/src/components/views/BomTemplatesPanel.tsx:297` blocks Save on hard trust blockers.
- `client/src/components/views/BomTemplatesPanel.tsx:331` blocks or previews Apply before mutation.
- `client/src/components/views/__tests__/BomTemplatesPanel.test.tsx:145` covers blocker behavior.
- `client/src/components/views/__tests__/BomTemplatesPanel.test.tsx:178` covers warning-only preview and confirmed mutation.
- `client/src/lib/__tests__/export-precheck.test.ts:391` covers the `bom-template-apply` profile.

## Verification

Passed:

- `npm run test -- client/src/lib/__tests__/export-precheck.test.ts client/src/components/views/__tests__/BomTemplatesPanel.test.tsx`
  - 2 files, 83 tests passed.
- `npm run check`
  - TypeScript passed.
- `npm run check:api-types`
  - API types are up to date.
- `node .agents/skills/pp-view-bom-templates/scripts/inspect-bom-templates.mjs`
  - Skill inspection passed and now detects 1 BOM Templates test file.
- `npm run page-skills:check`
  - Coverage check passed.
- `npm run page-skills:audit-packs`
  - Pack audit passed.
- `npm run build`
  - Build completed.

Warnings / failures encountered:

- `npm run build` still emits the existing Vite large-chunk warning. Largest chunks remain `SchematicView`, `extends`, main `index`, `CodeEditor`, and `react-vendor`. This is still a separate perf slice; I did not hide it by raising `chunkSizeWarningLimit`.
- `npm run build` also emits `[meta-images] no Replit deployment domain found, skipping meta tag updates`.
- `PLAYWRIGHT_HTML_OPEN=never npm run test:a11y -- --reporter=dot` failed: 10 passed, 21 failed, 1 flaky. Failures include broad route timeouts plus existing serious axe findings in Breadboard (`label`) and Simulation (`button-name`, `color-contrast`).
- `PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/tab-route-matrix.spec.ts --reporter=dot` failed: 17 passed, 14 failed. Later route groups timed out waiting for `[data-testid="workspace-main"]`.
- `npm run test:keyboard-nav` was not run after the broad a11y and route-matrix failures, to avoid adding another noisy browser sweep before the current failures are triaged.

## Docs Checked

- Context7: React `/reactjs/react.dev` for derived render/useMemo guidance.
- Context7: Playwright `/microsoft/playwright.dev` for browser binary install/cache behavior after Tyler asked why Playwright keeps reinstalling browsers.

## Adversarial Notes

- This implementation closes the narrow BOM Templates gate, but the round cannot honestly be called clean while the requested browser safety net is red.
- The browser failures are not localized to BOM Templates. They hit many late route groups and heavy views that predate this slice, but they still block a full verification signoff under the warning/error policy.
- `bom-template-apply` currently gates against current project trust state, not a true server-side dry run of template line diffs. The preview is a safe confirmation step, but a future stronger version should use the detail endpoint to show created/skipped item rows before mutation.

---
ROUND_STATUS: needs-revision
OPEN_CRITIQUES: build still has known large-chunk warning; a11y sweep failed broad cross-view checks; route matrix failed broad late-route checks; template preview is confirmation-first, not item-level diff yet
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Triage broad browser verification failures or explicitly split them into an infrastructure/debt wave, then continue money-gate rollout to Inventory, Supply Chain, Lifecycle, and Procurement-adjacent flows.
---
