## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R36.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R36_CODEX.md
- Claimed files: client/src/lib/viewer-3d-bridge.ts; client/src/lib/__tests__/viewer-3d-bridge.test.ts; client/src/components/views/CommunityView.tsx; client/src/components/views/GenerativeDesignView.tsx; client/src/components/views/BoardViewer3DView.tsx; client/src/components/views/__tests__/CommunityView.test.tsx; client/src/components/views/__tests__/GenerativeDesignView.test.tsx; client/src/components/views/__tests__/BoardViewer3DView.test.tsx; e2e/p1-viewer-3d-bridge.spec.ts; .agents/skills/pp-view-community/references/testing.md; .agents/skills/pp-view-community/references/self-improvement-log.md; .agents/skills/pp-view-generative/references/testing.md; .agents/skills/pp-view-generative/references/self-improvement-log.md; .agents/skills/pp-view-3d/references/testing.md; .agents/skills/pp-view-3d/references/self-improvement-log.md; COLLAB_FULL_APP_BACKLOG_HANDOFF_R36.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R36_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/browser checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current Codex lane)

# ProtoPulse Full App Views Backlog R36 - Community and Generative 3D Provenance

## Context

R35 locked the Component Editor 3D bridge contract. Community and Generative already route into the 3D viewer, but some high-value provenance is still hidden in source-only UI or subtitle text: Community author trust and Generative fitness should travel as explicit bridge fields and render as visible 3D viewer badges.

## Scope

- Extend the shared 3D bridge payload with optional source identity, source trust score, and numeric fitness score.
- Publish Community author name/reputation through the 3D bridge.
- Publish Generative candidate fitness as a structured field through the 3D bridge.
- Render those fields in the 3D viewer provenance card.
- Cover library normalization, Community source publishing, Generative source publishing, 3D viewer rendering, and focused browser route behavior.
- Update Community, Generative, and 3D View skill references.

## Verification Required

- `npm run test -- client/src/lib/__tests__/viewer-3d-bridge.test.ts client/src/components/views/__tests__/CommunityView.test.tsx client/src/components/views/__tests__/GenerativeDesignView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `node .agents/skills/pp-view-community/scripts/inspect-community.mjs`
- `node .agents/skills/pp-view-generative/scripts/inspect-generative.mjs`
- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1 -g "community|generative"`
- `npm run check`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Land Community and Generative 3D provenance as explicit bridge fields and prove the visible card behavior.
---
