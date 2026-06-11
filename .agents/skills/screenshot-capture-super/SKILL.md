---
name: screenshot-capture-super
description: "Research-backed, production-grade screenshot capture workflow for Playwright. Use when the user asks for exhaustive screenshots, visual audits, UI state catalogs, element-level captures, responsive captures, or deterministic screenshot pipelines with manifests and validation. Includes preflight checks, auth/project bootstrap, capture execution, artifact verification, and failure-forensics traces."
version: 1.0.0
---

# Screenshot Capture Super

Use this skill for serious screenshot work where completeness and repeatability matter.

## What This Skill Does

1. Runs environment and dependency preflight.
2. Creates a fresh authenticated test account + project through API (no stale session dependence).
3. Captures panel-level and element-level screenshots by scripted scenario.
4. Emits machine-readable manifest and validation summary.
5. Records failure diagnostics for flaky states (trace + error report pointers).

## Mandatory Workflow

Run in this order:

```bash
./.agents/skills/screenshot-capture-super/scripts/doctor.sh
node ./.agents/skills/screenshot-capture-super/scripts/bootstrap-auth-project.mjs
node ./.agents/skills/screenshot-capture-super/scripts/capture-catalog.mjs --scope full-app
./.agents/skills/screenshot-capture-super/scripts/validate-catalog.sh --scope full-app
```

## Reliability Standards

- Never rely on old `storageState` files as sole auth source.
- Prefer API bootstrap for account/session/project setup.
- Use resilient locators (`getByTestId`, role/name) over brittle CSS chains.
- Capture both context (panel/full viewport) and detail (element crops).
- Validate artifact completeness from expected checklist patterns.
- Treat overlay interception as explicit logic branch:
  - first normal click
  - then force click if interception is known and expected
- Keep traces and failure screenshots for retry investigations.

## Inputs

- `--scope`: `sidebar` (default) or `full-app`
- `--viewports`: comma-separated (`desktop,laptop,short-laptop,tablet,mobile`)
- `--out`: optional output directory
- `--pilot`: capture only the first high-risk pilot set (Dashboard, AI Chat, sidebars, Validation, Exports)
- `--only`: comma-separated skill/view filters for focused debugging (example: `dashboard,pp-view-validation`)
- `--max-elements`: maximum visible `data-testid` element crops per view and viewport (default 120)
- `--max-interactions`: maximum tab/menu/toggle interactions per view and viewport (default 45)
- `--seed-mode`: `synthetic`, `current`, or `mixed` (default `mixed`)
- `--current-project-id`: project id for the current/local-data supplemental pass (default `1`)
- `--allow-panel-errors`: optional debug mode; permits captures even when `Sidebar region error` or `Chat region error` is present.

## Quality Gate Behavior

- Default mode is strict: the run fails when panel error surfaces are detected.
- Debug mode (`--allow-panel-errors`) is for evidence collection only while debugging app issues.

## Outputs

- Timestamped screenshot directory under `docs/audit-screenshots/`
- `MANIFEST.json` with machine-readable capture rows
- `MANIFEST.md` with every attempted capture and status
- `CHECKLIST.md` for required pattern coverage
- `CROSSWALK.md` mapping backlog report sections and skills to screenshot folders/status
- `FAILURES.md` with skipped/failed capture details
- `SUMMARY.json` with counts and pass/fail markers

## References

Read first when debugging:

- `references/playwright-research.md`
- `references/failure-modes-and-fixes.md`
