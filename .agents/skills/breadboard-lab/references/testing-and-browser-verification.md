# Breadboard Testing And Browser Verification

## Vitest Matrix

### Component tests

Cover:

- empty and seeded workbench states
- starter-part and project-part placement flows
- exact-part resolution and fallback draft path
- board-health surfacing and issue focus behavior
- selected-part inspector trust and readiness rendering
- coach preview and apply actions
- responsive shell behavior if layout changed

### Pure-library tests

Cover:

- board-audit issue generation and score ordering
- layout-quality scoring
- bench summary and trust inference
- sync duplication or conflict behavior
- collision and occupancy logic

## Browser Verification Checklist

After any Breadboard UI change:

1. Open the live app and navigate to Breadboard.
2. Verify the changed state with snapshot evidence.
3. Capture a screenshot of the relevant state.
4. Confirm no console errors appeared.
5. Exercise one real user flow end to end.
6. If layout changed, verify a narrower viewport too.

## Minimum Real Flows

Choose the flow that matches your change:

- create canvas → place starter part → wire → inspect
- open exact-part flow → resolve verified part or draft fallback → stage on board
- select part → preview coach plan → apply coach plan
- select part → verify work-surface status shows board health, provenance/trust, stash readiness, and coach moves without opening the sidebar
- select part → click View in 3D → verify `viewer_3d` opens and `protopulse:breadboard-view-in-3d` carries selected-part trust context
- run board health → expand issue → focus affected part
- sync content from schematic → verify breadboard provenance and behavior

## R24 Breadboard -> 3D Bridge Evidence

- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/views/__tests__/BoardViewer3DView.test.tsx client/src/lib/__tests__/viewer-3d-bridge.test.ts` passed with 84 tests.
- `npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1` passed with the Breadboard selected-part browser case included.
- Screenshot artifact: `e2e-results/r24-breadboard-view-in-3d.png`.

## R25 Work-Surface Health/Coach Evidence

- `BreadboardWorkSurfaceStatus` keeps board-health and selected-part coach state visible on the canvas surface.
- Browser proof belongs in `e2e/p1-breadboard-inspector-container.spec.ts` at 1366x720 and should capture `e2e-results/r25-breadboard-work-surface-status.png`.

## R28 Work-Surface Provenance Evidence

- `BreadboardWorkSurfaceStatus` also shows selected-part trust tier, pin-map confidence, verification level/status, and stash readiness on the canvas surface.
- `BreadboardView.test.tsx` covers the component-level selected-part provenance row.
- `e2e/p1-breadboard-inspector-container.spec.ts` covers the row in the laptop-height browser proof.
- Focused Breadboard a11y/keyboard gates should stay green for quick-intake labels and keyboard access to the scrollable workbench sidebar.

## R34 Overlay Container Evidence

- `BreadboardWorkSurfaceStatus` and `BreadboardPartInspector` expose `data-resizable="true"`, `data-resize-axis="both"`, and collapsed state so browser proofs can verify the UI Container Rule directly.
- The work-surface status toggle exposes `aria-expanded`, and the browser proof checks it through collapse/expand.
- `e2e/p1-breadboard-inspector-container.spec.ts` now checks laptop-height viewport containment, no overlap between the status dock and selected-part inspector, console warnings/errors, page errors, and the collapsed inspector's `View in 3D` reachability.

## R39 Contract Guard Evidence

- `client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts` now contains real guard assertions instead of placeholder documentation tests.
- The guard covers canonical instance provenance values, explicit and legacy provenance reads, bench/board/staged/conflicting placement states, coach trust ordering, and sync-created wire provenance.
- Focused R39 verification should include the guard file plus `BreadboardView.test.tsx` and `view-sync-provenance.test.ts`.
