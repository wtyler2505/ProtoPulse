# Breadboard Gotchas

Read this before changing Breadboard logic.

## File Shape

- `BreadboardView.tsx` is an orchestrator. Keep new local logic small. Move reusable behavior into focused helpers or child components.
- `breadboard-canvas/index.tsx` is pointer-heavy. Small changes can affect dragging, wiring, pan/zoom, and drop behavior.
- `BreadboardToolbar.tsx` is page-level. `CanvasToolbar.tsx` is canvas-level. Keep that boundary clear.

## State And Sync

- Bench/stash parts can exist before they are placed on the breadboard.
- Bench-placed parts can have bench coordinates while breadboard placement is still empty.
- The selected-part `View in 3D` action must keep dispatching `protopulse:breadboard-view-in-3d` before switching to `viewer_3d`; the 3D bridge pass depends on that context.
- Schematic-to-breadboard sync is handled near `client/src/lib/circuit-editor/view-sync.ts`.
- Do not create breadboard wires from schematic data unless both endpoints can be mapped safely.
- Inventory/procurement data may be unverified. UI must show uncertainty instead of acting certain.

## Tests

- Some Breadboard tests mock provider-heavy pieces. If a test warning appears, fix the warning instead of ignoring it.
- Hardware inspection tests may need API mocks, markdown rendering checks, and upload behavior checks.
- Trust-tier tests protect the difference between verified, inferred, and unknown part data.

## UI

- The Breadboard view has many controls already. Add new controls only when they are clearly findable and useful.
- If an action is important, do not bury it under vague menu text.
- If a menu grows, make it scrollable.
- If a panel grows, check small viewports.

## Tooling

- Vite 504 "Outdated Optimize Dep" errors usually mean the dev dependency cache needs a clean restart, not a React component bug.
- Desktop/Tauri command warnings are real defects when they affect app behavior. Permission warning spam should be fixed at the command allowlist/source.
- Context7 or primary docs are required before changing library, Vite, Tauri, React, testing, or browser-tooling assumptions.
