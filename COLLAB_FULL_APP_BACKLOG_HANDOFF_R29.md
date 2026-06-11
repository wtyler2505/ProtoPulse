## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R29.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R29_CODEX.md
- Claimed files:
  - client/src/components/views/SchematicView.tsx
  - client/src/components/views/__tests__/SchematicView.test.tsx
  - e2e/p1-schematic-canvas-provenance.spec.ts
  - .agents/skills/pp-view-schematic/references/testing.md
  - .agents/skills/pp-view-schematic/references/self-improvement-log.md
  - COLLAB_FULL_APP_BACKLOG_HANDOFF_R29.md
  - COLLAB_FULL_APP_BACKLOG_RESPONSE_R29_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, unrelated existing COLLAB_* files, .env, knowledge/**, data/pp-nlm/**
- Background sessions: current Codex resume session only for this lane; no build/test/dev-server session running at handoff creation
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: visible process list; current Codex session plus one unrelated Claude SDK job)

# ProtoPulse Full-App Backlog R29 - Schematic Canvas Provenance

## Source Context

- User resumed the full-app UI/UX, Breadboard Lab, Digital Twin, 3D viewer, and canvas-heavy backlog from docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md.
- R28 completed Breadboard work-surface provenance/status, a11y labels, and focused verification.
- R29 continues the canvas-heavy slice with Schematic because it is already partially hardened in the dirty tree and has focused tests.

## Docs And Local Evidence Checked

- Context7 React: derive display data during render; event work belongs in event handlers.
- Context7 Playwright: web-first locator assertions and accessible-name assertions for UI checks.
- Schematic skill references: page map, UX contract, testing guide, gotchas, self-improvement log.
- Current dirty files were inspected before edits:
  - client/src/components/views/SchematicView.tsx
  - client/src/components/views/__tests__/SchematicView.test.tsx
  - .agents/skills/pp-view-schematic/references/testing.md
  - .agents/skills/pp-view-schematic/references/self-improvement-log.md

## R29 Implementation Target

Add a narrow, testable Schematic work-surface status/provenance dock that:

- makes the active circuit name, canvas mode, instance count, ERC state, and AI/exact-part trust state visible directly on the canvas surface;
- reuses the shared TrustBadge primitive for verified/estimated/unverified status;
- stays compact, dismissible/collapsible, scroll-safe, and laptop-height friendly;
- does not replace or rewrite the existing TSCircuit adapter work;
- adds focused unit/browser coverage for the new provenance visibility.

## Planned Verification

- npm run test -- client/src/components/views/__tests__/SchematicView.test.tsx
- node .agents/skills/pp-view-schematic/scripts/inspect-schematic.mjs
- PLAYWRIGHT_HTML_OPEN=never npm run test:a11y -- --reporter=dot -g schematic
- PLAYWRIGHT_HTML_OPEN=never npm run test:keyboard-nav -- --reporter=dot -g schematic
- PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/tab-route-matrix.spec.ts --reporter=dot -g schematic
- npm run check
- npm run build
- npm run check:api-types
- npm run page-skills:check
- npm run page-skills:audit-packs

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Land the Schematic canvas provenance/status dock and verify it.
---
