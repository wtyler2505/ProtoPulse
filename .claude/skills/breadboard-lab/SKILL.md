---
name: breadboard-lab
description: ProtoPulse Breadboard Lab workbench skill for the full bench workflow. Use when working on BreadboardView, breadboard workbench UX, starter/project/exact-part placement, bench stash, board health, breadboard coach overlays, breadboard trust/readiness, breadboard realism, or schematic-to-breadboard sync. Triggers on breadboard, breadboard lab, board health, bench, exact part, starter shelf, breadboard coach, breadboard inventory, wire editing, breadboard sync, and breadboard workbench.
---

# Breadboard Lab

Use this skill for the Breadboard tab as a full maker workbench, not just an SVG canvas.

## Quick Reference

| Item | Value |
|------|-------|
| Main entrypoint | `client/src/components/circuit-editor/BreadboardView.tsx` |
| Workbench shell | `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx` |
| Board health | `client/src/lib/breadboard-board-audit.ts`, `BreadboardBoardAuditPanel.tsx` |
| Trust/readiness | `breadboard-bench.ts`, `breadboard-layout-quality.ts`, `breadboard-part-inspector.ts` |
| AI/coach | `useBreadboardCoachPlan.ts`, `BreadboardCoachOverlay.tsx`, `breadboard-ai-prompts.ts` |
| Sync layer | `client/src/lib/circuit-editor/view-sync.ts` |
| Key tests | `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx` |

## Use This Skill For

- Improving the Breadboard tab or any Breadboard workbench flow
- Adding or refining starter-part, project-part, or exact-part placement
- Surfacing board health, issue remediation, or focus flows
- Deepening coach suggestions, readiness/trust messaging, or AI prompts
- Improving breadboard realism, layout legibility, or maker onboarding
- Tightening schematic-to-breadboard sync and visible provenance
- Testing or verifying Breadboard behavior in Vitest and Chrome

## Do NOT Use This Skill For

| Instead of... | Use this skill... |
|--------------|-------------------|
| General schematic-only work | Use schematic context/patterns |
| PCB-only layout work | Use PCB-specific context |
| Pure generic test methodology | Compose with `testing-mastery` |
| Pure generic verification | Compose with `verification-mastery` |
| Styling unrelated to Breadboard behavior | Compose with `frontend-design` |

## Mandatory Breadboard Lens

Every Breadboard change must answer these questions:

1. Can a beginner understand how to start within 5 seconds?
2. Does the UI clearly distinguish starter/generic, project-linked, and verified exact parts?
3. Is build readiness grounded in what the user actually owns?
4. Does the change improve debugging confidence, not only visual density?
5. Does the Breadboard tab still feel coherent with schematic, inventory, validation, and AI guidance?
6. Is the improvement proven in a real browser, not only in tests?

## Working Model

Treat Breadboard Lab as five interlocked systems:

1. Workbench shell
   Starter Shelf, project part shelf, stash/inventory, exact-part flow, bench AI, board health.
2. Canvas editing
   Placement, wire editing, overlays, selection, zoom/pan, guidance states.
3. Trust and readiness
   Fit, model quality, pin-map confidence, stash truth, board-health score, layout quality.
4. Coach / AI
   Selected-part support planning, prompt shaping, actionability.
5. Sync and provenance
   Schematic ↔ breadboard coherence, duplicate prevention, visible origin of content.

Do not improve one of these while degrading the others.

## Standard Workflow

1. Start with `./breadboard-architecture-and-entrypoints.md`.
2. Identify which subsystem the request touches.
3. Check whether the capability already exists but is under-surfaced from `BreadboardView.tsx`.
4. Make the smallest change that improves the whole bench workflow.
5. Update the nearest Breadboard tests.
6. Verify the changed flow in Chrome DevTools.
7. If the work revealed durable Breadboard product knowledge, capture it in `knowledge/`.

## Browser Verification Rule

After any Breadboard UI change:

- Open the Breadboard tab in the live app.
- Verify the changed state with a fresh snapshot.
- Capture a screenshot of the relevant state.
- Check console errors after the interaction.
- Exercise at least one real user flow, not only an isolated control.
- If layout changed, verify a narrower viewport too.

Load `./breadboard-testing-and-browser-verification.md` for the full matrix.

## Reference Files

| File | Purpose |
|------|---------|
| `./breadboard-architecture-and-entrypoints.md` | File map, subsystem map, and where to start |
| `./breadboard-workflow-playbook.md` | Product workflow expectations and implementation heuristics |
| `./breadboard-testing-and-browser-verification.md` | Test matrix and Chrome verification checklist |
| `./breadboard-ai-audit-and-sync.md` | Coach, audit, trust, exact-part, and sync guidance |

## Related Skills

- `frontend-design`
- `testing-mastery`
- `verification-mastery`
- `project-context`
- `chromedevtools-mastery`

