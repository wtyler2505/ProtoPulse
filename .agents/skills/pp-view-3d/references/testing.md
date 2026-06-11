# 3D View Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
  - Package height map.
  - Empty-state rendering.
  - Component, trace, via, and layer-color DOM rendering.
  - Breadboard/generic bridge context card and matching refdes highlight.
  - Digital Twin live-state overlay and repair navigation from the 3D bridge card.
- `client/src/lib/__tests__/viewer-3d-bridge.test.ts`
  - Durable 3D target storage.
  - Generic source event dispatch.
  - Breadboard compatibility event dispatch.
  - Digital Twin live-state field normalization.
  - Community source name/reputation and Generative source/fitness payload normalization.
- `e2e/p1-viewer-3d-bridge.spec.ts`
  - Breadboard selected part -> 3D View route handoff with selected refdes, trust, pin-map, health, and ready/review state.
  - Component Editor exact part -> 3D View route handoff with verification level, pin-map confidence, model format, and ready state.
  - Community 3D model -> 3D View route handoff with source author, reputation, verification, and model format visible.
  - Generative candidate -> 3D View route handoff with AI provenance, source engine, structured fitness context, component count, and needs-review state.
  - Digital Twin -> 3D View route handoff with telemetry provenance card, live-state overlay, and fix-link controls visible.

## Skill Checks

- `node .agents/skills/pp-view-3d/scripts/inspect-3d.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Focused Commands

- `npm run test -- client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
- `npm run test -- client/src/lib/__tests__/viewer-3d-bridge.test.ts`
- `npm run test -- client/src/components/views/__tests__/DigitalTwinView.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`

## Browser Checks

For visible UI changes:

1. Open 3D View.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
