## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R3.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R3_CODEX.md
- Claimed files: client/src/lib/validation-safety-gates.ts, client/src/lib/__tests__/validation-safety-gates.test.ts, client/src/components/views/ValidationView.tsx, client/src/components/views/__tests__/ValidationView.test.tsx, client/src/components/panels/ExportPanel.tsx, client/src/pages/ProjectPickerPage.tsx, client/src/pages/__tests__/ProjectPickerPage.test.tsx, client/src/components/views/SampleProjectGallery.tsx, e2e/auth.setup.ts, e2e/e2e-project.ts, e2e/accessibility.spec.ts, e2e/p0-alternates-part-usage-render.spec.ts, e2e/p1-a11y-scan.spec.ts, e2e/p1-keyboard-nav.spec.ts, e2e/tab-route-matrix.spec.ts, .agents/skills/pp-view-validation/references/self-improvement-log.md, .agents/skills/pp-view-exports/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R3.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R3_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: current Codex turn; no long-running implementation workers left active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active implementation agents counted from prior lane header; no additional workers dispatched

# Full App Views Backlog Campaign R3

## Source Material

- Prior response: COLLAB_FULL_APP_BACKLOG_RESPONSE_R2_CODEX.md
- Validation skill: .agents/skills/pp-view-validation/SKILL.md
- Exports skill: .agents/skills/pp-view-exports/SKILL.md
- Current docs checked: Context7 React `/reactjs/react.dev`, Context7 Playwright `/microsoft/playwright.dev`

## Scope For This Round

Codex landed the visible Validation safety-gate and Exports trust-output slice:

- Create a pure shared safety-gate data builder for provenance, exact-part, 3D/mechanical, breadboard-health, lifecycle, and inventory-confidence counts.
- Render the same structured safety-gate checks in `ValidationView` with trust badges and visible block/warn/pass status.
- Feed Exports from the same shared safety-gate counts.
- Remove the recurring E2E hard-coded `/projects/1` failure from the active Playwright gate specs by reading the setup-created project id from storage state.
- Remove the root Project Picker serious axe blocker by splitting card-open behavior into a native button, keeping Hide/Restore as a separate action, and raising local contrast.
- Scope the Project Picker a11y scan to the setup-created project name so leaked historical E2E projects do not balloon the scan DOM.

## Verification Notes

- Core unit/type/build checks passed.
- Targeted Validation Playwright checks passed after the project-id helper fix.
- Focused Project Picker unit and a11y checks passed after the native-button/contrast fix.
- Full `test:a11y` is not clean because the all-view axe scan now times out across 30 existing view tests. The original Project Picker serious `color-contrast`/`nested-interactive` blocker is fixed; the remaining blocker is suite-level timeout/scoping debt.
- Existing Vite large-chunk warning remains accepted separate perf debt from R1/R2.

---
ROUND_STATUS: needs-revision
OPEN_CRITIQUES: full p1-a11y-scan still fails from cross-view axe/playwright 30s timeout debt even though Project Picker focused a11y now passes
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Stabilize or explicitly backlog the full a11y suite timeout/scoping debt; then proceed to the next money/action gate slice.
---
