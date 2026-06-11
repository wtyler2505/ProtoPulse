## Lane Reservation

- Active channels: GROK_SCREENSHOT_REVIEW_HANDOFF.md / GROK_SCREENSHOT_REVIEW_DONE.json
- Claimed files: read-only review of `.agents/skills/screenshot-capture-super/**`, `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md`, `docs/audit-screenshots/latest-full-app-catalog/**`, `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx`
- Forbidden files: all production edits, all unrelated docs, existing `CODEX_*`, `GROK_HANDOFF.md`, `COLLAB_*`
- Background sessions: Codex pilot full-app screenshot capture session running; Grok review launched as bounded one-turn plan/review
- Round type: review-only
- Target file edits permitted this round: no
- Agent cap status: 3/6 active after Grok launch (source: visible process list + current Codex capture process)

# Grok Review Request: Full-App Screenshot Collection Phase

Tyler asked Codex to implement the screenshot collection phase for improving `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md`.

Codex has already implemented a Playwright-based full-app capture lane under:

- `.agents/skills/screenshot-capture-super/scripts/capture-catalog.mjs`
- `.agents/skills/screenshot-capture-super/scripts/validate-catalog.sh`
- `.agents/skills/screenshot-capture-super/SKILL.md`
- `.agents/skills/screenshot-capture-super/references/playwright-research.md`

The goal is to collect current screenshots for every documented full-app view/page skill in the backlog report, with evidence folders and manifests that can later be used to enrich the report.

## Current Research Basis

Codex checked Context7 for `/microsoft/playwright` and official Playwright docs:

- https://playwright.dev/docs/screenshots
- https://playwright.dev/docs/test-snapshots
- https://playwright.dev/docs/trace-viewer-intro
- https://playwright.dev/docs/browsers
- https://playwright.dev/docs/locators
- https://playwright.dev/docs/actionability
- https://playwright.dev/docs/auth

Key implementation choices:

- `page.screenshot` and `locator.screenshot` with stable screenshot options.
- `animations: "disabled"`, `caret: "hide"`, `scale: "css"`, and screenshot `style`.
- `fullPage` screenshots for route views.
- data-testid / role based capture where available.
- trace capture with screenshots and snapshots only when a target/viewport has failures.
- fallback to installed Chrome via `channel: "chrome"` if bundled Chromium is missing.

## Current Implementation Shape

Full-app mode:

```bash
node .agents/skills/screenshot-capture-super/scripts/capture-catalog.mjs \
  --scope full-app \
  --viewports desktop,laptop,short-laptop,tablet,mobile \
  --seed-mode mixed \
  --max-elements 120 \
  --max-interactions 45
```

Bounded pilot mode:

```bash
node .agents/skills/screenshot-capture-super/scripts/capture-catalog.mjs \
  --scope full-app \
  --pilot \
  --viewports desktop \
  --seed-mode synthetic \
  --max-elements 3 \
  --max-interactions 0
```

Validator:

```bash
./.agents/skills/screenshot-capture-super/scripts/validate-catalog.sh --scope full-app
```

Artifacts:

- `MANIFEST.md`
- `MANIFEST.json`
- `CHECKLIST.md`
- `CROSSWALK.md`
- `FAILURES.md`
- `SUMMARY.json`
- optional `traces/*.zip`

## What Has Already Been Verified

- `node --check .agents/skills/screenshot-capture-super/scripts/capture-catalog.mjs`
- `bash -n .agents/skills/screenshot-capture-super/scripts/validate-catalog.sh`
- full dry-run inventory found 40 entries
- focused dashboard capture validated
- focused validation capture validated after locator crop fallback
- six-view pilot is currently being rerun after fixing a Radix dialog warning in `ProjectSettingsPanel.tsx`

## Review Task

Review the implementation and answer only with JSON.

Do not edit files.
Do not run destructive commands.
Do not start subagents.

Focus on:

1. Does the capture plan actually cover the full backlog report surface?
2. What gaps remain before running the expensive all-views/all-viewports capture?
3. Are the skip/failure semantics good enough for later backlog-report enrichment?
4. Are there any Playwright reliability risks in the current design?
5. Are there low-cost improvements Codex should make immediately before the full run?

Use file/path references where useful.

Expected JSON shape:

```json
{
  "status": "ok | needs_changes | blocked",
  "summary": "short summary",
  "blockers": ["..."],
  "risks": ["..."],
  "recommended_immediate_changes": ["..."],
  "full_run_go_no_go": "go | no_go",
  "notes_for_backlog_report_enrichment": ["..."]
}
```

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: pending Grok review
SIGNOFF: Codex
OWNERSHIP: Grok - review current screenshot capture lane
NEXT_ROUND: Codex reads Grok output, applies any low-cost fixes, validates pilot, then reports outcome
---
