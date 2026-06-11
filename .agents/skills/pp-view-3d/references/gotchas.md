# 3D View Gotchas

## Common Risks

- Passing tests do not prove the layout is good.
- A page can be reachable by URL while the rendered view fails to change.
- Fixed heights and nested overflow can create scroll traps.
- Mocked tests can hide runtime warnings.
- View-specific changes can still affect workspace navigation.
- Cross-view `CustomEvent` handoffs can fire before 3D View mounts. Persist the pending payload in a tiny bridge store, then have 3D View read it on mount and subscribe for live updates.
- The 3D bridge is now source-agnostic. Use `viewer-3d-bridge.ts` for Component Editor, Community, and Generative handoffs; keep `breadboard-3d-bridge.ts` as the legacy Breadboard wrapper.
- If the viewer has traces, vias, drill holes, or components, render the scene shell. Do not gate the board substrate only on components, or trace/via-only tests and scenes look empty.

## Before Finishing

- Run the nearest tests.
- Run this skill's inspector.
- Check visible UI in a browser when layout changed.
- Update `references/self-improvement-log.md` with durable lessons.
