## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R37.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R37_CODEX.md
- Claimed files: client/src/components/views/DigitalTwinView.tsx; client/src/components/views/__tests__/DigitalTwinView.test.tsx; e2e/p1-viewer-3d-bridge.spec.ts; .agents/skills/pp-view-digital-twin/references/testing.md; .agents/skills/pp-view-digital-twin/references/self-improvement-log.md; COLLAB_FULL_APP_BACKLOG_HANDOFF_R37.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R37_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/browser checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current Codex lane)

# ProtoPulse Full App Views Backlog R37 - Digital Twin Next Actions

## Context

R33 made the Digital Twin 3D behavior preview resizable and collapsible. R36 tightened 3D bridge provenance for Community and Generative. The Digital Twin backlog still calls for health-driven next actions: stale, unconfigured, or failing telemetry should point directly to the relevant repair surface instead of leaving the user to infer the next move.

## Scope

- Add a compact next-action strip inside the Digital Twin 3D behavior preview.
- Surface at least:
  - unconfigured or manifest-only state -> generate firmware manifest.
  - stale telemetry -> check Breadboard wiring.
  - warning/failing comparison -> inspect in 3D and re-verify component data.
- Keep the preview source-side and container-safe; do not introduce a nested card.
- Cover the default and stale telemetry paths in page-level tests.
- Extend the existing browser bridge proof to verify the default Digital Twin next action is visible.
- Update Digital Twin skill references.

## Verification Required

- `npm run test -- client/src/components/views/__tests__/DigitalTwinView.test.tsx`
- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1 -g "digital twin"`
- `npm run check`
- `npm run page-skills:check`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Add Digital Twin next actions and prove the default/stale paths.
---
