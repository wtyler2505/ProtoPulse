# Breadboard Lab Phase 2+5: Interaction & Feel + Sync & Interop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **For `/agent-teams`:** This plan has three parallel tracks. See Agent Teams section below.

**Goal:** Make the breadboard feel physically satisfying (collision, snap animation, keyboard nav, undo, T-junctions, drag-to-move, starter circuits) while hardening cross-tool sync and Fritzing interop in parallel.

**Architecture:** Phase 2 adds body-volume collision detection, real-time drag feedback, keyboard cursor navigation, tactile snap animations, wire T-junction forking, undo/redo integration (via existing UndoRedoStack Command pattern), drag-to-move for placed components, pre-wired starter circuit templates, and a connectivity explainer overlay. Phase 5 adds wire provenance badges, stress-tests the delta sync engine, writes the BL-0571 shared netlist architecture spec, and hardens FZPZ export with 9px grid compliance and connector ID validation.

**Tech Stack:** React 19 + TypeScript 5.6 + Vite 7 + Tailwind v4 + shadcn/ui + Vitest 4 + happy-dom + Drizzle ORM

**Spec:** `docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md` (S1-03 through S6-07, S3-01 through S5-04)

**Prerequisite:** Phase 0+1 complete (bench surface model, dual placement, 20 SVG families, 10 verified boards).

---

## Existing Infrastructure (Post Phase 0+1)

| Module | File | Lines | Status |
|--------|------|-------|--------|
| Bench surface model | `client/src/lib/circuit-editor/bench-surface-model.ts` | 201 | NEW — zones, snapping, WireEndpoint types |
| Breadboard view | `client/src/components/circuit-editor/BreadboardView.tsx` | 2061 | Modified — dual placement, bench rendering |
| Breadboard grid | `client/src/components/circuit-editor/BreadboardGrid.tsx` | 494 | Production — SVG grid, hover/highlight |
| Breadboard model | `client/src/lib/circuit-editor/breadboard-model.ts` | 460 | Modified — placement types |
| Wire editor | `client/src/components/circuit-editor/BreadboardWireEditor.tsx` | 346 | Modified — jumper wire support |
| Undo/redo engine | `client/src/lib/undo-redo.ts` | 190 | Production — UndoRedoStack, UndoableCommand interface |
| View sync | `client/src/lib/circuit-editor/view-sync.ts` | 716 | Production — bidirectional delta sync |
| Component export | `server/component-export.ts` | 535 | Production — FZPZ export |
| Fritzing exporter | `server/export/fritzing-exporter.ts` | 73 | Skeletal — basic .fzz XML |
| FZZ handler | `server/export/fzz-handler.ts` | 699 | Production — FZPZ import |

---

## `/agent-teams` Composition — 3 Parallel Tracks

### Team A: `interaction-core` (S1-03, S1-04, S1-05, S6-05, S6-04)

**Focus:** Collision, drag feedback, fit zones, undo/redo, drag-to-move.
**File ownership (exclusive):**
- `client/src/lib/circuit-editor/breadboard-model.ts` (body collision)
- `client/src/lib/circuit-editor/body-bounds.ts` (CREATE)
- `client/src/components/circuit-editor/BreadboardView.tsx` (drag feedback, undo integration, drag-to-move)
- `client/src/components/circuit-editor/BreadboardGrid.tsx` (fit-zone overlay rendering)
- `client/src/lib/circuit-editor/breadboard-undo.ts` (CREATE — breadboard UndoableCommand implementations)

**Spawn prompt:**
```
You are implementing collision detection, drag feedback, fit zones, undo/redo, and drag-to-move for ProtoPulse's Breadboard Lab.
Read the plan: docs/superpowers/plans/2026-04-10-breadboard-interaction-and-sync.md — Tasks 1-5.
Read the spec: docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md — S1-03, S1-04, S1-05, S6-05, S6-04.

YOUR EXCLUSIVE FILES:
- client/src/lib/circuit-editor/breadboard-model.ts
- client/src/lib/circuit-editor/body-bounds.ts (CREATE)
- client/src/lib/circuit-editor/breadboard-undo.ts (CREATE)
- client/src/components/circuit-editor/BreadboardView.tsx
- client/src/components/circuit-editor/BreadboardGrid.tsx
- Test files for above

DO NOT TOUCH: useBreadboardCursor.ts, starter-circuits.ts, BreadboardConnectivityExplainer.tsx, view-sync.ts, component-export.ts, fritzing-exporter.ts, fzz-handler.ts, BreadboardWireEditor.tsx

Execute tasks sequentially: 1 → 2 → 3 → 4 → 5.
Task 4 (undo) MUST complete before Task 5 (drag-to-move).
TDD: failing test → verify failure → implement → verify pass → commit.
npm run check after every task. Zero TS errors.

Key context:
- undo-redo.ts exports UndoableCommand interface: { type, description, execute(), undo() }
- UndoRedoStack class with push(), undo(), redo() methods
- bench-surface-model.ts has determinePlacementMode, WireEndpoint types, isWithinBreadboard
- BreadboardView.tsx handleDrop is around line 1490, uses checkCollision from breadboard-model.ts
```

### Team B: `interaction-ux` (S6-01, S6-02, S6-03, S6-06, S6-07)

**Focus:** Keyboard navigation, snap animation, T-junctions, starter circuits, connectivity explainer.
**File ownership (exclusive):**
- `client/src/lib/circuit-editor/useBreadboardCursor.ts` (CREATE)
- `client/src/lib/circuit-editor/starter-circuits.ts` (CREATE)
- `client/src/components/circuit-editor/BreadboardConnectivityExplainer.tsx` (CREATE)
- `client/src/components/circuit-editor/BreadboardWireEditor.tsx` (T-junction forking)
- CSS animation classes in `client/src/components/circuit-editor/breadboard-animations.css` (CREATE)

**Spawn prompt:**
```
You are implementing keyboard navigation, snap animation, T-junctions, starter circuits, and connectivity explainer for ProtoPulse's Breadboard Lab.
Read the plan: docs/superpowers/plans/2026-04-10-breadboard-interaction-and-sync.md — Tasks 6-10.
Read the spec: docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md — S6-01, S6-02, S6-03, S6-06, S6-07.

YOUR EXCLUSIVE FILES:
- client/src/lib/circuit-editor/useBreadboardCursor.ts (CREATE)
- client/src/lib/circuit-editor/starter-circuits.ts (CREATE)
- client/src/components/circuit-editor/BreadboardConnectivityExplainer.tsx (CREATE)
- client/src/components/circuit-editor/BreadboardWireEditor.tsx (T-junction only)
- client/src/components/circuit-editor/breadboard-animations.css (CREATE)
- Test files for above

DO NOT TOUCH: BreadboardView.tsx, BreadboardGrid.tsx, breadboard-model.ts, body-bounds.ts, breadboard-undo.ts, view-sync.ts, any server/ files

Execute tasks: 6 → 7 → 8 → 9 → 10 (mostly independent, do in order).
TDD: failing test → verify failure → implement → verify pass → commit.
npm run check after every task. Zero TS errors.

Key context:
- BB.PITCH = 10 (pixels per 0.1"), BB.ROWS = 63, BB.ALL_COLS = ['a'..'j']
- coordToPixel / pixelToCoord in breadboard-model.ts for coordinate transforms
- BreadboardWireEditor.tsx handles wire drawing — extend for T-junction click-to-split
- Starter circuits should produce valid CircuitInstanceRow + CircuitWireRow data
```

### Team C: `sync-interop` (S3-01, S3-02, S5-01, S5-02, S5-03, S5-04)

**Focus:** Wire provenance, sync hardening, Fritzing interop.
**File ownership (exclusive):**
- `client/src/lib/circuit-editor/view-sync.ts` (sync hardening)
- `server/component-export.ts` (9px grid, ID matching)
- `server/export/fritzing-exporter.ts` (enrich .fzz)
- `server/export/fzz-handler.ts` (import validation)
- Test files for above

**Spawn prompt:**
```
You are hardening cross-tool sync and Fritzing interop for ProtoPulse's Breadboard Lab.
Read the plan: docs/superpowers/plans/2026-04-10-breadboard-interaction-and-sync.md — Tasks 11-16.
Read the spec: docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md — S3-01, S3-02, S3-03, S5-01, S5-02, S5-03, S5-04.

YOUR EXCLUSIVE FILES:
- client/src/lib/circuit-editor/view-sync.ts
- server/component-export.ts
- server/export/fritzing-exporter.ts
- server/export/fzz-handler.ts
- Test files for above

DO NOT TOUCH: BreadboardView.tsx, BreadboardGrid.tsx, breadboard-model.ts, any breadboard-components/, any verified-boards/, BreadboardWireEditor.tsx

Execute tasks: 11 → 12 → 13 → 14 → 15 → 16. Task 16 is a document output (ADR), not code.
TDD: failing test → verify failure → implement → verify pass → commit.
npm run check after every task. Zero TS errors.

Key context:
- view-sync.ts: SyncResult with wiresToCreate/wireIdsToDelete/conflicts. extractSegments() for net JSONB.
- circuit_wires now has provenance column ('manual'|'synced'|'coach'|'jumper') and endpointMeta JSONB.
- component-export.ts: FZPZ ZIP with FZP XML + SVG. Must enforce 9px grid for connector positions.
- fritzing-exporter.ts: basic .fzz XML at 73 lines. Needs major expansion.
- fzz-handler.ts: 699-line import handler. Needs validation pass.
- Fritzing spec: connectors at 9px multiples (0.1" at 90 DPI), XML connector IDs must match SVG element IDs.
```

### Team Execution Checklist
- [ ] Context7 + WebSearch research (Fritzing FZPZ spec, UndoableCommand patterns)
- [ ] `/agent-teams` spawn with prompts above — 3 parallel teammates
- [ ] Plan approval from user
- [ ] Each agent: implement → `npm run check` → `npm test` → commit per task
- [ ] Lead reviews commits
- [ ] All agents complete → integration test in Chrome DevTools
- [ ] Clean up team

---

## Phase 2: Interaction & Feel

### Task 1: Body-volume collision detection (S1-03)

**Files:**
- Create: `client/src/lib/circuit-editor/body-bounds.ts`
- Modify: `client/src/lib/circuit-editor/breadboard-model.ts` (add `checkBodyCollision`)
- Test: `client/src/lib/circuit-editor/__tests__/body-bounds.test.ts` (CREATE)

**Context:** Current `checkCollision()` in breadboard-model.ts only checks if two placements share the same occupied tie-point holes. Two tall components (electrolytic cap next to a relay) can overlap physically even when their pins don't conflict. We need a body-volume check using bounding boxes derived from component type + package dimensions.

- [ ] **Step 1: Write failing tests for body bounds**

Create `body-bounds.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getBodyBounds, checkBodyOverlap, type BodyBounds } from '../body-bounds';

describe('body-bounds', () => {
  describe('getBodyBounds', () => {
    it('returns tall bounds for electrolytic capacitor', () => {
      const bounds = getBodyBounds('capacitor', 2, { subType: 'electrolytic' });
      expect(bounds.height).toBeGreaterThan(bounds.width); // tall profile
    });

    it('returns flat bounds for axial resistor', () => {
      const bounds = getBodyBounds('resistor', 2);
      expect(bounds.height).toBeLessThan(5); // flat profile
    });

    it('returns wide bounds for DIP IC based on pin count', () => {
      const bounds8 = getBodyBounds('ic', 8);
      const bounds16 = getBodyBounds('ic', 16);
      expect(bounds16.width).toBeGreaterThan(bounds8.width);
    });
  });

  describe('checkBodyOverlap', () => {
    it('detects overlap between adjacent tall components', () => {
      const a: BodyBounds = { x: 100, y: 50, width: 20, height: 30 };
      const b: BodyBounds = { x: 110, y: 50, width: 20, height: 30 };
      expect(checkBodyOverlap(a, b)).toBe(true);
    });

    it('allows adjacent flat components', () => {
      const a: BodyBounds = { x: 100, y: 50, width: 20, height: 4 };
      const b: BodyBounds = { x: 110, y: 50, width: 20, height: 4 };
      expect(checkBodyOverlap(a, b)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement body-bounds.ts**

```typescript
export interface BodyBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BodyProfile {
  widthPerPin: number; // mm per pin-pair for DIP, fixed for others
  baseWidth: number;   // mm
  height: number;      // mm above board surface
}

const PROFILES: Record<string, BodyProfile> = {
  resistor:    { widthPerPin: 0, baseWidth: 8, height: 3 },
  capacitor:   { widthPerPin: 0, baseWidth: 6, height: 4 },
  electrolytic:{ widthPerPin: 0, baseWidth: 10, height: 15 },
  led:         { widthPerPin: 0, baseWidth: 5, height: 8 },
  ic:          { widthPerPin: 2.54, baseWidth: 7.62, height: 5 },
  diode:       { widthPerPin: 0, baseWidth: 6, height: 3 },
  transistor:  { widthPerPin: 0, baseWidth: 5, height: 6 },
  relay:       { widthPerPin: 0, baseWidth: 15, height: 12 },
  potentiometer:{ widthPerPin: 0, baseWidth: 10, height: 10 },
  button:      { widthPerPin: 0, baseWidth: 6, height: 5 },
  crystal:     { widthPerPin: 0, baseWidth: 12, height: 4 },
  buzzer:      { widthPerPin: 0, baseWidth: 12, height: 10 },
  regulator:   { widthPerPin: 0, baseWidth: 10, height: 15 },
};

const SCALE = 10 / 2.54; // pixels per mm (BB.PITCH = 10px per 0.1" = 2.54mm)

export function getBodyBounds(
  componentType: string,
  pinCount: number,
  opts?: { subType?: string },
): BodyBounds {
  const key = opts?.subType === 'electrolytic' ? 'electrolytic' : componentType.toLowerCase();
  const profile = PROFILES[key] ?? { widthPerPin: 0, baseWidth: 8, height: 5 };
  const widthMm = profile.widthPerPin > 0
    ? profile.baseWidth + (pinCount / 2 - 1) * profile.widthPerPin
    : profile.baseWidth;
  return {
    x: 0, y: 0,
    width: widthMm * SCALE,
    height: profile.height * SCALE,
  };
}

export function checkBodyOverlap(a: BodyBounds, b: BodyBounds): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x ||
           a.y + a.height <= b.y || b.y + b.height <= a.y);
}
```

- [ ] **Step 4: Add `checkBodyCollision` to breadboard-model.ts**

Extend existing collision logic to include body overlap check.

- [ ] **Step 5: Run tests, verify pass, commit**

```bash
git commit -m "feat(breadboard): add body-volume collision detection (S1-03)"
```

---

### Task 2: Real-time drag collision feedback (S1-04)

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (handleDragOver enhancement)
- Modify: `client/src/components/circuit-editor/BreadboardGrid.tsx` (visual feedback rendering)
- Test: Extend existing BreadboardView tests

**Context:** During drag over the breadboard zone, the snap preview currently shows a neutral color. Enhance it to show red when placement would cause a collision (hole or body) and green when valid. Use the new `checkBodyCollision` from Task 1.

- [ ] **Step 1: Write test for drag feedback state**

```typescript
it('sets collision state to true when drag position conflicts', () => {
  // Test the collision check logic during drag, not the SVG rendering
});
```

- [ ] **Step 2: Implement in BreadboardView.tsx handleDragOver**

Add collision check during drag: compute placement, run `checkCollision` + `checkBodyCollision`, set a `dragCollision` state boolean. Pass to BreadboardGrid for visual feedback.

- [ ] **Step 3: Implement visual feedback in BreadboardGrid.tsx**

When `dragCollision` is true, render the snap preview circle/rect with red fill. When false, green fill. Add `data-testid="drop-preview-valid"` / `data-testid="drop-preview-collision"`.

- [ ] **Step 4: Run tests, verify, commit**

```bash
git commit -m "feat(breadboard): real-time red/green drag collision feedback (S1-04)"
```

---

### Task 3: Fit-zone overlay for large boards (S1-05)

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardGrid.tsx` (overlay rendering)
- Modify: `client/src/lib/circuit-editor/breadboard-model.ts` (add `getAvailableZones`)
- Test: Extend breadboard-model tests

- [ ] **Step 1: Write test for getAvailableZones**

```typescript
describe('getAvailableZones', () => {
  it('returns reduced available holes after ESP32 placement', () => {
    const placement = { startCol: 'a', startRow: 10, endCol: 'j', endRow: 30, spansCenterChannel: true };
    const available = getAvailableZones([placement]);
    // ESP32 uses most columns — only 1 free column per side
    expect(available.length).toBeLessThan(63 * 10); // less than full board
  });
});
```

- [ ] **Step 2: Implement getAvailableZones in breadboard-model.ts**
- [ ] **Step 3: Render overlay in BreadboardGrid.tsx** — togglable via toolbar button, dims unavailable holes, highlights available ones
- [ ] **Step 4: Run tests, verify, commit**

```bash
git commit -m "feat(breadboard): fit-zone overlay showing usable space after placement (S1-05)"
```

---

### Task 4: Breadboard undo/redo (S6-05)

**Files:**
- Create: `client/src/lib/circuit-editor/breadboard-undo.ts`
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (Ctrl+Z/Ctrl+Shift+Z, push commands)
- Test: `client/src/lib/circuit-editor/__tests__/breadboard-undo.test.ts` (CREATE)

**Context:** The existing `undo-redo.ts` provides `UndoRedoStack` with `push(cmd)`, `undo()`, `redo()` and `UndoableCommand` interface requiring `{ type, description, execute(), undo() }`. We need breadboard-specific command implementations for place/delete component, draw/delete wire, and move component.

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  PlaceComponentCommand,
  DrawWireCommand,
  DeleteWireCommand,
} from '../breadboard-undo';

describe('breadboard undo commands', () => {
  it('PlaceComponentCommand.undo removes the instance', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const cmd = new PlaceComponentCommand({
      instanceId: 42,
      description: 'Place R1',
      deleteFn,
      recreateFn: vi.fn().mockResolvedValue(undefined),
    });
    await cmd.undo();
    expect(deleteFn).toHaveBeenCalledWith(42);
  });

  it('DrawWireCommand.undo removes the wire', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const cmd = new DrawWireCommand({
      wireId: 99,
      description: 'Draw wire a1→a5',
      deleteFn,
      recreateFn: vi.fn().mockResolvedValue(undefined),
    });
    await cmd.undo();
    expect(deleteFn).toHaveBeenCalledWith(99);
  });
});
```

- [ ] **Step 2: Implement breadboard-undo.ts**

Command classes implementing `UndoableCommand` for: PlaceComponent, DeleteComponent, DrawWire, DeleteWire, MoveComponent. Each stores the data needed to reverse the action.

- [ ] **Step 3: Wire Ctrl+Z/Ctrl+Shift+Z in BreadboardView.tsx**

Add keyboard handlers. Create an `UndoRedoStack` instance (or use existing project-level one). Push commands from handleDrop, wire creation, wire deletion.

- [ ] **Step 4: Run tests, verify, commit**

```bash
git commit -m "feat(breadboard): undo/redo for placement, wiring, and deletion (S6-05)"
```

---

### Task 5: Drag-to-move placed components (S6-04)

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (new drag-move mode)
- Test: Extend BreadboardView tests

**Context:** Currently components are locked after placement. Enable click-and-drag on placed components to move them. On-board: snaps to new hole, runs collision check. On-bench: free-form. Connected wires update endpoints (rubber-band effect). The move is an undoable command (depends on Task 4).

- [ ] **Step 1: Write test**

```typescript
it('moves placed component and updates wire endpoints', () => {
  // Verify that moving instance from a1 to a5 updates connected wire startpoints
});
```

- [ ] **Step 2: Implement drag-to-move**

Add mousedown handler on rendered components. When dragging:
1. Enter move mode (distinct from wire-draw mode)
2. Show ghost at cursor with collision check
3. On drop: update instance position, update connected wire endpoints
4. Push MoveComponentCommand for undo

- [ ] **Step 3: Run tests, verify, commit**

```bash
git commit -m "feat(breadboard): drag-to-move components with wire follow and undo (S6-04)"
```

---

### Task 6: Keyboard-driven breadboard navigation (S6-01)

**Files:**
- Create: `client/src/lib/circuit-editor/useBreadboardCursor.ts`
- Test: `client/src/lib/circuit-editor/__tests__/useBreadboardCursor.test.ts` (CREATE)

**Context:** Create a React hook managing a visible cursor that moves between breadboard holes via arrow keys. Tab cycles through placed components. Enter starts/finishes wire drawing. The hook returns cursor position, active state, and keyboard handler.

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { moveCursor, type CursorState } from '../useBreadboardCursor';

describe('breadboard cursor', () => {
  const initial: CursorState = { col: 'a', row: 1, active: true };

  it('moves down on ArrowDown', () => {
    const next = moveCursor(initial, 'ArrowDown');
    expect(next.row).toBe(2);
    expect(next.col).toBe('a');
  });

  it('moves right on ArrowRight (a → b)', () => {
    const next = moveCursor(initial, 'ArrowRight');
    expect(next.col).toBe('b');
  });

  it('clamps at board edges', () => {
    const edge: CursorState = { col: 'j', row: 63, active: true };
    const next = moveCursor(edge, 'ArrowDown');
    expect(next.row).toBe(63);
  });

  it('moves 5 rows on Shift+ArrowDown', () => {
    const next = moveCursor(initial, 'ArrowDown', true);
    expect(next.row).toBe(6);
  });
});
```

- [ ] **Step 2: Implement useBreadboardCursor.ts**

Pure `moveCursor` function + React hook `useBreadboardCursor` that wraps it with `useState` and keyboard event handling.

- [ ] **Step 3: Run tests, verify, commit**

```bash
git commit -m "feat(breadboard): keyboard cursor navigation with arrow keys and tab cycling (S6-01)"
```

---

### Task 7: Tactile snap animation (S6-02)

**Files:**
- Create: `client/src/components/circuit-editor/breadboard-animations.css`
- Test: Snapshot test for CSS classes

- [ ] **Step 1: Create CSS animation keyframes**

```css
@keyframes breadboard-snap-pulse {
  0% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.05); filter: brightness(1.2); }
  100% { transform: scale(1); filter: brightness(1); }
}

@keyframes breadboard-row-flash {
  0% { opacity: 0; }
  30% { opacity: 0.8; }
  100% { opacity: 0; }
}

.bb-snap-pulse { animation: breadboard-snap-pulse 120ms ease-out; }
.bb-row-flash { animation: breadboard-row-flash 200ms ease-out; }

@media (prefers-reduced-motion: reduce) {
  .bb-snap-pulse, .bb-row-flash { animation: none; }
}
```

- [ ] **Step 2: Wire animations into placement and wire endpoint events** (in the BreadboardGrid or via callback props)
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(breadboard): tactile snap animation on placement and wire landing (S6-02)"
```

---

### Task 8: Wire T-junction forking (S6-03)

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardWireEditor.tsx`
- Test: Extend wire editor tests

- [ ] **Step 1: Write test for wire split at junction point**

```typescript
it('splits wire into two segments at junction point', () => {
  // Wire from a1→a10, click at a5
  // Result: wire a1→a5 + wire a5→a10 + new branch starts at a5
});
```

- [ ] **Step 2: Implement click-on-wire detection and split logic**
- [ ] **Step 3: Render T-junction marker (small dot at branch point)**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(breadboard): wire T-junction forking with click-to-split (S6-03)"
```

---

### Task 9: Starter circuit templates (S6-06)

**Files:**
- Create: `client/src/lib/circuit-editor/starter-circuits.ts`
- Test: `client/src/lib/circuit-editor/__tests__/starter-circuits.test.ts` (CREATE)

- [ ] **Step 1: Write tests**

```typescript
describe('starter circuits', () => {
  it('LED circuit has resistor + LED + 2 wires', () => {
    const circuit = getStarterCircuit('led-basic');
    expect(circuit.instances).toHaveLength(2); // R1, LED1
    expect(circuit.wires.length).toBeGreaterThanOrEqual(2);
  });

  it('all starter circuits produce valid coordinates', () => {
    for (const id of getStarterCircuitIds()) {
      const circuit = getStarterCircuit(id);
      for (const inst of circuit.instances) {
        expect(inst.breadboardX).toBeGreaterThan(0);
        expect(inst.breadboardY).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Implement 4 starter circuits** (LED+resistor, voltage divider, button+LED, H-bridge)
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(breadboard): 4 pre-wired starter circuit templates (S6-06)"
```

---

### Task 10: Breadboard connectivity explainer overlay (S6-07)

**Files:**
- Create: `client/src/components/circuit-editor/BreadboardConnectivityExplainer.tsx`
- Test: `client/src/components/circuit-editor/__tests__/BreadboardConnectivityExplainer.test.tsx` (CREATE)

- [ ] **Step 1: Write test**

```typescript
it('renders 5-hole row group annotations', () => {
  render(<BreadboardConnectivityExplainer />);
  expect(screen.getByTestId('connectivity-explainer')).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement** — SVG overlay showing internal bus connections, row group colors, power rail markers, center channel annotation
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(breadboard): connectivity explainer overlay for first-timers (S6-07)"
```

---

## Phase 5: Sync & Interop

### Task 11: Wire provenance visual badges (S3-01)

**Files:**
- Modify: `client/src/lib/circuit-editor/view-sync.ts` (set provenance on synced wires)
- Test: Extend view-sync tests

- [ ] **Step 1: Write test** — verify synced wires get `provenance: 'synced'`
- [ ] **Step 2: Implement** — `syncSchematicToBreadboard` sets provenance on created wires
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(breadboard): wire provenance tracking in sync engine (S3-01)"
```

---

### Task 12: Delta sync hardening (S3-02)

**Files:**
- Create: `client/src/lib/circuit-editor/__tests__/view-sync-stress.test.ts`
- Modify: `client/src/lib/circuit-editor/view-sync.ts` (edge case fixes)

- [ ] **Step 1: Write 20+ stress tests**

```typescript
describe('view-sync stress tests', () => {
  it('handles concurrent edits in both views', () => { /* ... */ });
  it('handles delete-while-wiring', () => { /* ... */ });
  it('handles bulk paste of 20 components', () => { /* ... */ });
  it('handles rapid view toggle', () => { /* ... */ });
  it('never silently drops a wire', () => { /* ... */ });
  it('never duplicates a wire', () => { /* ... */ });
  // ... 14 more edge cases
});
```

- [ ] **Step 2: Fix any failures found**
- [ ] **Step 3: Commit**

```bash
git commit -m "test(breadboard): 20+ stress tests for delta sync engine (S3-02)"
```

---

### Task 13: FZPZ 9px grid compliance (S5-01)

**Files:**
- Modify: `server/component-export.ts`
- Test: `server/__tests__/fzpz-grid-compliance.test.ts` (CREATE)

- [ ] **Step 1: Write tests**

```typescript
it('snaps connector positions to 9px multiples', () => {
  // Export a 14-pin DIP, verify all coords are 9px multiples
});

it('rejects off-grid positions', () => {
  // Connector at 13px (not multiple of 9) → validation error
});
```

- [ ] **Step 2: Implement `validateFritzingGrid()` and snap logic**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(export): FZPZ 9px grid compliance for connector positions (S5-01)"
```

---

### Task 14: XML/SVG connector ID matching (S5-02)

**Files:**
- Modify: `server/component-export.ts` (add validation pass)
- Test: Extend FZPZ tests

- [ ] **Step 1: Write test** — matching IDs pass, mismatched IDs error with detail
- [ ] **Step 2: Implement pre-package validation**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(export): FZPZ connector ID validation between XML and SVG (S5-02)"
```

---

### Task 15: Enrich .fzz project exporter (S5-03)

**Files:**
- Modify: `server/export/fritzing-exporter.ts` (major expansion)
- Test: `server/__tests__/fritzing-exporter-enriched.test.ts` (CREATE)

- [ ] **Step 1: Write tests** — export 5-component circuit, verify XML has coordinates + wires + nets
- [ ] **Step 2: Expand from 73 lines to ~300+** with view coords, wire routing, net connectivity
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(export): enriched .fzz exporter with coordinates, wires, and nets (S5-03)"
```

---

### Task 16: Import validation pipeline + BL-0571 architecture spec (S5-04 + S3-03)

**Files:**
- Modify: `server/export/fzz-handler.ts` (add validation pass)
- Create: `docs/adr/0006-shared-netlist-model.md` (architecture spec)
- Test: Extend fzz-handler tests

- [ ] **Step 1: Add validation to FZPZ import** — grid check, ID match, view presence
- [ ] **Step 2: Write ADR for BL-0571** — canonical netlist data model, migration path, 4-6 milestones
- [ ] **Step 3: Commit both**

```bash
git commit -m "feat(export): FZPZ import validation pipeline + BL-0571 architecture spec (S5-04, S3-03)"
```

---

## Post-Implementation

After all 16 tasks complete:
1. `npm run check && npm test` — zero errors
2. Chrome DevTools verification: drag collision feedback, keyboard navigation, undo/redo, T-junctions, starter circuit, connectivity overlay
3. Plan Phase 3+4 (intelligence + inventory) — depends on S6-05 (undo) being done
