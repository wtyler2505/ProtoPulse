# Codex Completion Report

**Task:** Execute the next Breadboard Lab iteration with real bench-pin wiring, endpoint metadata, and deeper fidelity/provenance behavior
**Status:** done

## Changes Made
- `client/src/lib/circuit-editor/breadboard-bench-connectors.ts` - added a shared bench-anchor projection utility so exact bench rendering and wire interactions agree on real connector positions, including rotation
- `client/src/components/circuit-editor/BreadboardBenchPartRenderer.tsx` - exposed real connector hit targets on bench parts and made them usable as wire-start / wire-end interaction points
- `client/src/components/circuit-editor/BreadboardView.tsx` - added bench-pin endpoint resolution, persisted `endpointMeta`, promoted bench-linked manual wires to `provenance: 'jumper'`, and marked coach-staged jumpers with `provenance: 'coach'`
- `client/src/lib/circuit-editor/hooks.ts` - extended create/update wire mutations to carry `endpointMeta` and `provenance`
- `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx` - added coverage for creating a jumper directly from exact bench connector anchors with structured endpoint metadata

## Commands Run
```bash
npm test -- client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx shared/verified-boards/__tests__/to-part-state.test.ts
npm test -- client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx client/src/components/circuit-editor/__tests__/BreadboardShoppingList.test.tsx shared/verified-boards/__tests__/to-part-state.test.ts
git status --short
git diff -- client/src/components/circuit-editor/BreadboardView.tsx client/src/components/circuit-editor/BreadboardBenchPartRenderer.tsx client/src/lib/circuit-editor/breadboard-bench-connectors.ts client/src/lib/circuit-editor/hooks.ts client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx
```

## Next Steps
- Expand exact, source-backed geometry from boards into modules where physical fit matters most: ESP32 devkits, motor drivers, display modules, relay boards, and common sensor breakouts
- Teach the wire editor drag path to preview bench-pin snapping during drag, not only on drop
- Add a live browser validation pass for bench-pin wiring, impossible-fit rejection, and off-board-only module behavior

## Blockers (if any)
- No code blockers in this loop
- The existing `BreadboardShoppingList` happy-dom test still logs `TypeError: URL is not a constructor` during CSV export, but the suite passes and this loop did not change that path

## Handoff Notes
This loop keeps unrelated workspace changes untouched (`data/metrics.json`, session logs, and the deleted lockfile). The bench surface now has a real interaction contract: exact connector anchors are no longer cosmetic, wires created from those anchors store structured endpoint metadata, and coach-created jumpers now carry explicit provenance for downstream UI treatment.
