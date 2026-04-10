# Breadboard Testing And Browser Verification

## Vitest Matrix

### Component tests

Cover:

- empty and seeded workbench states
- starter-part and project-part placement flows
- exact-part resolution and fallback draft path
- board-health surfacing and issue focus behavior
- selected-part inspector trust/readiness rendering
- coach preview/apply actions
- responsive shell behavior if layout changed

### Pure-lib tests

Cover:

- board audit issue generation and score ordering
- layout-quality scoring
- bench summary/trust inference
- sync duplication/conflict behavior
- collision and occupancy logic

## Browser Verification Checklist

After any Breadboard UI change:

1. Open the live app and navigate to Breadboard.
2. Verify the changed state with snapshot evidence.
3. Capture a screenshot of the relevant state.
4. Confirm no console errors appeared.
5. Exercise one real user flow end-to-end.
6. If layout changed, verify a narrower viewport too.

## Minimum Real Flows

Choose the flow that matches your change:

- create canvas → place starter part → wire → inspect
- open exact-part flow → resolve verified part or draft fallback → stage on board
- select part → preview coach plan → apply coach plan
- run board health → expand issue → focus affected part
- sync content from schematic → verify breadboard provenance/behavior

## Done Criteria For Breadboard

Do not call Breadboard work done until all of these are true:

- targeted Vitest coverage exists or was updated
- typecheck passes
- the relevant Breadboard flow was verified in a real browser
- the claimed UX improvement is visible in the browser, not only implied by code

