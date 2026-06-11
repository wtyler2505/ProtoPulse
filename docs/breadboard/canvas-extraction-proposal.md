# Breadboard Canvas Extraction — Proposed Structure & Boundaries
**Part of:** Wave 0 Foundations
**Date:** 2026-05-18
**Goal:** Break `breadboard-canvas/index.tsx` (1,677 LOC) into focused, testable, ownable modules while preserving all current behavior.

---

## Current Problem (Recap)

- One file owns: viewport, bench surface, wire editing, coach integration, drop logic, rendering composition, sync timing, auto-placement, accessibility, undo, etc.
- The file itself admits it should have been split.
- Every high-risk area (bench duality, sync, coach, provenance) is entangled here.

---

## Proposed New Structure

```
client/src/components/circuit-editor/breadboard-canvas/
├── index.tsx                    ← Thin composition layer only (< 500 LOC target)
├── types.ts                     ← Shared types for the canvas surface
│
├── viewport/
│   ├── useCanvasViewport.ts
│   ├── CanvasCoordinateReadout.tsx
│   └── viewport-helpers.ts
│
├── bench-surface/
│   ├── BenchSurfaceManager.ts   ← **Critical** — owns bench vs board distinction
│   ├── BreadboardBenchPartRenderer.tsx (move here)
│   ├── bench-surface-model.ts
│   └── bench-connector-helpers.ts
│
├── wire-editing/
│   ├── WireEditingEngine.ts     ← State machine for wire drawing
│   ├── BreadboardWireEditor.tsx (enhance/move)
│   ├── WireColorMenu.tsx
│   └── wire-editing-helpers.ts
│
├── coach/
│   ├── CoachIntegrationLayer.ts ← Consumes useBreadboardCoachPlan cleanly
│   ├── BreadboardCoachPlanOverlay.tsx (move)
│   ├── BreadboardPinAnchorOverlay.tsx (move)
│   └── coach-remediation-handlers.ts
│
├── rendering/
│   ├── CanvasComposition.tsx    ← The big SVG return logic
│   ├── CanvasToolbar.tsx        ← Already extracted, keep here
│   ├── CanvasEmptyGuidance.tsx
│   └── layers/                  ← Grid, overlays, simulation, etc.
│
├── input/
│   ├── useBreadboardCursor.ts   ← May stay or move
│   └── drag-drop-handlers.ts
│
└── __tests__/
    └── (per-module tests)
```

---

## Module Ownership & Responsibilities (Proposed)

### 1. BenchSurfaceManager (Highest Priority)
**Owner:** To be assigned (very important)
**Scope:**
- All logic that decides "is this part on the bench or on the board?"
- benchInstances filtering and memoization
- Bench connector anchor calculation and click handling
- Drop logic that lands parts on the bench vs the grid
- Coordinate transform decisions between bench and breadboard space

**Why first after viewport:** This is the soul of the "Lab". Getting this module clean and well-tested protects the entire mental model.

### 2. WireEditingEngine
**Scope:**
- Wire-in-progress state machine
- Mouse/tie-point handling for drawing
- Provenance tagging at wire creation time (`manual`, `synced`, `coach`, `jumper`)
- Context menu + color menu behavior

### 3. CoachIntegrationLayer
**Scope:**
- Clean interface for consuming `useBreadboardCoachPlan`
- Management of coach visibility, resolved suggestions, prepared hookups/bridges
- Remediation application handlers
- Must not know about raw pointer events or SVG transforms

### 4. Viewport
**Scope:**
- Pure geometry + input routing (pan, zoom, coordinate transforms)
- Lowest coupling. Good first extraction target.

### 5. CanvasComposition (the final slim index.tsx)
**Scope:**
- Only assembles the other modules
- Owns the top-level SVG return
- Routes events to the right engine
- Should become boring

---

## Extraction Order Recommendation

1. **Viewport** (safest, low behavior risk)
2. **BenchSurfaceManager** (highest conceptual risk — do this early while context is fresh)
3. **WireEditingEngine**
4. **CoachIntegrationLayer**
5. **Final slimming + deletion of old code**

---

## Invariants That Must Be Preserved

- Every instance and wire must continue to receive correct provenance at creation.
- Bench parts must continue to support wiring via connector anchors.
- Coach plans must continue to resolve and apply exactly as today.
- Sync timing (waiting for auto-placement) must continue to work.
- No observable change in drag/drop, wiring, selection, or coach behavior during the extraction.

---

## Next Steps (If Approved)

- After user review of this proposal, lock the boundaries.
- Begin Phase 1.1: Extract Viewport (lowest risk).
- Simultaneously harden the `breadboard-lab-contracts.test.ts` assertions as modules are extracted.

---

**This proposal is ready for discussion.** I will not start moving code until we agree on the boundaries.