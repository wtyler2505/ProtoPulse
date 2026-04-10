# Breadboard Lab: Bench Surface Foundation + Visual Expansion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Agent teams:** This plan is designed for `/agent-teams` with two parallel teams (see Team Execution section).

**Goal:** Transform the breadboard canvas from a grid-only editor into a bench surface with dual placement modes (on-board + on-bench), then expand visual realism with 13+ new SVG component families and 7+ verified board profiles.

**Architecture:** Phase 0 introduces a `BenchSurface` wrapper around the existing `BreadboardGrid`, enabling free-form placement outside the breadboard zone with smart snapping near it. Schema adds `benchX`/`benchY` to `circuit_instances` and `endpointMeta`/`provenance` to `circuit_wires`. Phase 1 adds new SVG renderers in `breadboard-components/` and new verified board definitions in `shared/verified-boards/`, extending the existing `detectFamily()` routing and `findVerifiedBoardByAlias()` lookup.

**Tech Stack:** React 19 + TypeScript 5.6 + SVG + Drizzle ORM + Vitest + happy-dom

**Spec:** `docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md` (S0-01 through S1-02)

---

## Existing Infrastructure

| Module | File | Status |
|--------|------|--------|
| Breadboard grid | `client/src/components/circuit-editor/BreadboardGrid.tsx` | Production — 830-point SVG grid |
| Breadboard view | `client/src/components/circuit-editor/BreadboardView.tsx` | Production — placement, wiring, pan/zoom |
| Grid model | `client/src/lib/circuit-editor/breadboard-model.ts` | Production — coords, collision, connectivity |
| Wire editor | `client/src/components/circuit-editor/BreadboardWireEditor.tsx` | Production — point-to-point wiring |
| Component renderer | `client/src/components/circuit-editor/BreadboardComponentRenderer.tsx` | Production — 7 SVG families |
| SVG components | `client/src/components/circuit-editor/breadboard-components/` | 7 files: Resistor, Capacitor, LED, IC, Diode, Transistor, Wire |
| Verified boards | `shared/verified-boards/` | 3 boards: ESP32, Mega 2560, RioRand |
| Board type system | `shared/verified-boards/types.ts` | BreadboardFit, VerifiedBoardDefinition |
| Board converter | `shared/verified-boards/to-part-state.ts` | Verified board → part state |
| Bench insights | `client/src/lib/breadboard-bench.ts` | BreadboardBenchInsight, fit classification |
| Schema | `shared/schema.ts` | `circuitInstances` (breadboardX/Y nullable real), `circuitWires` (points jsonb) |
| Starter shelf | `client/src/components/circuit-editor/BreadboardStarterShelf.tsx` | 7 starter parts |

---

## Phase Overview

| Phase | Description | Tasks | Team | Can Parallel? |
|-------|-------------|-------|------|---------------|
| **Phase 0** | Bench Surface Foundation | 1-8 (S0-01 to S0-04) | Team A: `bench-surface` | Sequential within phase |
| **Phase 1** | Visual Expansion | 9-12 (S1-01 + S1-02) | Team B: `visual-expansion` | Parallel with Phase 0 |

**Phase 0 and Phase 1 run in parallel** — zero file overlap between teams.

---

## `/agent-teams` Composition

### Team A: `bench-surface` (Phase 0)

**File ownership (exclusive):**
- `client/src/components/circuit-editor/BreadboardView.tsx`
- `client/src/components/circuit-editor/BenchSurface.tsx` (NEW)
- `client/src/components/circuit-editor/BreadboardWireEditor.tsx`
- `client/src/lib/circuit-editor/breadboard-model.ts`
- `shared/schema.ts` (only the `benchX`/`benchY` + `endpointMeta`/`provenance` additions)

**Spawn prompt:**
```
You are implementing the Bench Surface Foundation for ProtoPulse's Breadboard Lab.
Read the plan at docs/superpowers/plans/2026-04-10-breadboard-bench-surface-and-visual-expansion.md — Tasks 1-8 (Phase 0).
Read the spec at docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md — Section S0.

Your exclusive files:
- client/src/components/circuit-editor/BreadboardView.tsx
- client/src/components/circuit-editor/BenchSurface.tsx (create)
- client/src/components/circuit-editor/BreadboardWireEditor.tsx
- client/src/lib/circuit-editor/breadboard-model.ts
- shared/schema.ts (only benchX/benchY + endpointMeta/provenance columns)

DO NOT touch any files in breadboard-components/ or shared/verified-boards/ — those belong to another team.
Execute tasks sequentially: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.
TDD: write failing test → verify failure → implement → verify pass → commit.
Run npm run check after every task. Zero TS errors allowed.
```

### Team B: `visual-expansion` (Phase 1)

**File ownership (exclusive):**
- `client/src/components/circuit-editor/breadboard-components/` (all new SVG files)
- `client/src/components/circuit-editor/BreadboardComponentRenderer.tsx`
- `shared/verified-boards/` (all new board profile files)
- `shared/verified-boards/index.ts` (register new boards)

**Spawn prompt:**
```
You are expanding the Breadboard Lab's visual component library for ProtoPulse.
Read the plan at docs/superpowers/plans/2026-04-10-breadboard-bench-surface-and-visual-expansion.md — Tasks 9-12 (Phase 1).
Read the spec at docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md — Section S1-01 and S1-02.

Your exclusive files:
- client/src/components/circuit-editor/breadboard-components/ (create new SVG files)
- client/src/components/circuit-editor/BreadboardComponentRenderer.tsx (extend detectFamily)
- shared/verified-boards/ (create new board profiles)
- shared/verified-boards/index.ts (register new boards)

DO NOT touch BreadboardView.tsx, BenchSurface.tsx, breadboard-model.ts, or BreadboardWireEditor.tsx — those belong to another team.
Tasks 9 and 10 are independent and can be done in any order.
Tasks 11 and 12 are independent and can be done in any order.
TDD: write failing test → verify failure → implement → verify pass → commit.
Run npm run check after every task. Zero TS errors allowed.

For SVG components, follow the pattern in existing files:
- ResistorSvg.tsx (value-driven rendering with color bands)
- CapacitorSvg.tsx (polarized/non-polarized variants)
- IcSvg.tsx (DIP package with pin labels)
Each new SVG must render at BB.PITCH (10px per 0.1") scale.

For verified boards, follow the pattern in:
- shared/verified-boards/nodemcu-esp32s.ts (full pin map, traps, fit classification)
- shared/verified-boards/mega-2560-r3.ts (not_breadboard_friendly example)
All pin data MUST come from official datasheets — use Context7 or WebSearch to verify.
```

---

## Team Execution Checklist

- [ ] **Research**: Context7 + WebSearch for any library/API questions before implementation
- [ ] **Spawn teams**: `/agent-teams` with prompts above — 2 teams, parallel execution
- [ ] **Plan approval**: Review this plan with the user before teams start
- [ ] **Implement**: Teams execute their tasks with TDD
- [ ] **Check**: `npm run check` passes with zero errors after every task
- [ ] **Test**: `npm test` passes — verify no regressions
- [ ] **Commit**: Each task gets its own commit
- [ ] **Cleanup**: Remove any temporary files, verify no debug code left

---

## Phase 0: Bench Surface Foundation

### Task 1: Schema — Add bench placement columns to circuit_instances

**Files:**
- Modify: `shared/schema.ts` (add `benchX`, `benchY` columns to `circuitInstances`)
- Test: `shared/__tests__/schema-bench-columns.test.ts` (NEW)

**Context:** The `circuitInstances` table has nullable `breadboardX`/`breadboardY` for on-board placement. We add nullable `benchX`/`benchY` for on-bench placement. An instance is on-board when breadboard coords are set, on-bench when bench coords are set, unplaced when both are null.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { circuitInstances, insertCircuitInstanceSchema } from '@shared/schema';

describe('circuit_instances bench columns', () => {
  it('schema includes benchX and benchY columns', () => {
    const columns = Object.keys(circuitInstances);
    expect(columns).toContain('benchX');
    expect(columns).toContain('benchY');
  });

  it('insert schema accepts benchX and benchY as optional', () => {
    const result = insertCircuitInstanceSchema.safeParse({
      circuitId: 1,
      referenceDesignator: 'U1',
      schematicX: 0,
      schematicY: 0,
      benchX: 150.5,
      benchY: 200.0,
    });
    expect(result.success).toBe(true);
  });

  it('insert schema accepts null benchX/benchY (unplaced)', () => {
    const result = insertCircuitInstanceSchema.safeParse({
      circuitId: 1,
      referenceDesignator: 'U1',
      schematicX: 0,
      schematicY: 0,
      benchX: null,
      benchY: null,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/__tests__/schema-bench-columns.test.ts`
Expected: FAIL — `benchX` and `benchY` not in schema

- [ ] **Step 3: Add columns to schema**

In `shared/schema.ts`, inside the `circuitInstances` table definition, after the `breadboardRotation` line:

```typescript
  benchX: real("bench_x"),
  benchY: real("bench_y"),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/__tests__/schema-bench-columns.test.ts`
Expected: PASS

- [ ] **Step 5: Run full check**

Run: `npm run check && npm test`
Expected: Zero TS errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add shared/schema.ts shared/__tests__/schema-bench-columns.test.ts
git commit -m "feat(schema): add benchX/benchY columns to circuit_instances for bench surface placement"
```

---

### Task 2: Schema — Add endpointMeta and provenance to circuit_wires

**Files:**
- Modify: `shared/schema.ts` (add `endpointMeta` jsonb, `provenance` text to `circuitWires`)
- Test: `shared/__tests__/schema-wire-provenance.test.ts` (NEW)

**Context:** `circuit_wires` stores wire data as `points` JSONB array. We add `endpointMeta` (structured endpoint info for bench-to-board jumpers) and `provenance` (origin tracking: manual/synced/coach/jumper).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { circuitWires, insertCircuitWireSchema } from '@shared/schema';

describe('circuit_wires bench fields', () => {
  it('schema includes endpointMeta and provenance columns', () => {
    const columns = Object.keys(circuitWires);
    expect(columns).toContain('endpointMeta');
    expect(columns).toContain('provenance');
  });

  it('insert schema accepts provenance values', () => {
    const result = insertCircuitWireSchema.safeParse({
      circuitId: 1,
      netId: 1,
      view: 'breadboard',
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      provenance: 'manual',
    });
    expect(result.success).toBe(true);
  });

  it('insert schema accepts endpointMeta as jsonb', () => {
    const meta = {
      start: { type: 'hole', col: 'a', row: 1 },
      end: { type: 'bench-pin', instanceId: 42, pinId: 'GPIO5' },
    };
    const result = insertCircuitWireSchema.safeParse({
      circuitId: 1,
      netId: 1,
      view: 'breadboard',
      points: [{ x: 0, y: 0 }, { x: 150, y: 200 }],
      endpointMeta: meta,
      provenance: 'jumper',
    });
    expect(result.success).toBe(true);
  });

  it('provenance defaults to manual when omitted', () => {
    const result = insertCircuitWireSchema.safeParse({
      circuitId: 1,
      netId: 1,
      view: 'breadboard',
      points: [],
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/__tests__/schema-wire-provenance.test.ts`
Expected: FAIL — `endpointMeta` and `provenance` not in schema

- [ ] **Step 3: Add columns to schema**

In `shared/schema.ts`, inside the `circuitWires` table definition, after the `wireType` line:

```typescript
  endpointMeta: jsonb("endpoint_meta"),
  provenance: text("provenance").default("manual"),
```

- [ ] **Step 4: Run tests and check**

Run: `npx vitest run shared/__tests__/schema-wire-provenance.test.ts && npm run check`
Expected: PASS, zero TS errors

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts shared/__tests__/schema-wire-provenance.test.ts
git commit -m "feat(schema): add endpointMeta and provenance to circuit_wires for bench jumpers"
```

---

### Task 3: BenchSurface wrapper component

**Files:**
- Create: `client/src/components/circuit-editor/BenchSurface.tsx`
- Test: `client/src/components/circuit-editor/__tests__/BenchSurface.test.tsx` (NEW)

**Context:** `BenchSurface` wraps the existing `BreadboardGrid` as a child zone within a larger SVG canvas. It manages: overall surface dimensions, the breadboard zone position, pan/zoom for the whole surface, and the snap threshold (proximity to breadboard zone triggers grid snapping). Currently `BreadboardView.tsx` manages pan/zoom directly — that logic moves here.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BenchSurface, {
  BENCH_DEFAULTS,
  isWithinBreadboardZone,
  type BenchPosition,
} from '../BenchSurface';

describe('BenchSurface', () => {
  describe('isWithinBreadboardZone', () => {
    it('returns true for position inside breadboard bounds', () => {
      const pos: BenchPosition = { x: 100, y: 100 };
      expect(isWithinBreadboardZone(pos, BENCH_DEFAULTS)).toBe(true);
    });

    it('returns true for position within snap threshold of breadboard edge', () => {
      // Just outside the board but within 20px threshold
      const pos: BenchPosition = {
        x: BENCH_DEFAULTS.breadboardOrigin.x - 15,
        y: BENCH_DEFAULTS.breadboardOrigin.y + 50,
      };
      expect(isWithinBreadboardZone(pos, BENCH_DEFAULTS)).toBe(true);
    });

    it('returns false for position on bench surface outside snap range', () => {
      const pos: BenchPosition = { x: -100, y: -100 };
      expect(isWithinBreadboardZone(pos, BENCH_DEFAULTS)).toBe(false);
    });
  });

  describe('BENCH_DEFAULTS', () => {
    it('defines breadboard origin and surface dimensions', () => {
      expect(BENCH_DEFAULTS.surfaceWidth).toBeGreaterThan(0);
      expect(BENCH_DEFAULTS.surfaceHeight).toBeGreaterThan(0);
      expect(BENCH_DEFAULTS.breadboardOrigin.x).toBeGreaterThan(0);
      expect(BENCH_DEFAULTS.breadboardOrigin.y).toBeGreaterThan(0);
      expect(BENCH_DEFAULTS.snapThreshold).toBeGreaterThan(0);
    });

    it('surface is larger than breadboard', () => {
      expect(BENCH_DEFAULTS.surfaceWidth).toBeGreaterThan(
        BENCH_DEFAULTS.breadboardWidth + BENCH_DEFAULTS.breadboardOrigin.x
      );
    });
  });

  describe('rendering', () => {
    it('renders bench surface container with data-testid', () => {
      render(<BenchSurface>{null}</BenchSurface>);
      expect(screen.getByTestId('bench-surface')).toBeInTheDocument();
    });

    it('renders breadboard zone indicator', () => {
      render(<BenchSurface>{null}</BenchSurface>);
      expect(screen.getByTestId('breadboard-zone')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/components/circuit-editor/__tests__/BenchSurface.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement BenchSurface**

Create `client/src/components/circuit-editor/BenchSurface.tsx`:

```typescript
import { memo, type ReactNode } from 'react';
import { BB, getBoardDimensions } from '@/lib/circuit-editor/breadboard-model';

export interface BenchPosition {
  x: number;
  y: number;
}

export interface BenchConfig {
  surfaceWidth: number;
  surfaceHeight: number;
  breadboardOrigin: BenchPosition;
  breadboardWidth: number;
  breadboardHeight: number;
  snapThreshold: number;
}

const boardDims = getBoardDimensions();

export const BENCH_DEFAULTS: BenchConfig = {
  surfaceWidth: boardDims.width + 400,   // 200px margin each side
  surfaceHeight: boardDims.height + 300,  // 150px margin top/bottom
  breadboardOrigin: { x: 200, y: 150 },
  breadboardWidth: boardDims.width,
  breadboardHeight: boardDims.height,
  snapThreshold: 20,
};

export function isWithinBreadboardZone(
  pos: BenchPosition,
  config: BenchConfig = BENCH_DEFAULTS,
): boolean {
  const { breadboardOrigin: o, breadboardWidth: w, breadboardHeight: h, snapThreshold: t } = config;
  return (
    pos.x >= o.x - t &&
    pos.x <= o.x + w + t &&
    pos.y >= o.y - t &&
    pos.y <= o.y + h + t
  );
}

interface BenchSurfaceProps {
  children: ReactNode;
  config?: BenchConfig;
}

const BenchSurface = memo(function BenchSurface({
  children,
  config = BENCH_DEFAULTS,
}: BenchSurfaceProps) {
  return (
    <g data-testid="bench-surface">
      {/* Bench surface background */}
      <rect
        x={0}
        y={0}
        width={config.surfaceWidth}
        height={config.surfaceHeight}
        fill="#1a1a14"
        rx={4}
      />
      {/* Breadboard zone indicator */}
      <rect
        data-testid="breadboard-zone"
        x={config.breadboardOrigin.x - 4}
        y={config.breadboardOrigin.y - 4}
        width={config.breadboardWidth + 8}
        height={config.breadboardHeight + 8}
        fill="none"
        stroke="#334155"
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={0.5}
        rx={2}
      />
      {/* Breadboard grid renders inside the zone via transform */}
      <g transform={`translate(${String(config.breadboardOrigin.x)}, ${String(config.breadboardOrigin.y)})`}>
        {children}
      </g>
    </g>
  );
});

export default BenchSurface;
```

- [ ] **Step 4: Run tests and check**

Run: `npx vitest run client/src/components/circuit-editor/__tests__/BenchSurface.test.tsx && npm run check`
Expected: PASS, zero TS errors

- [ ] **Step 5: Commit**

```bash
git add client/src/components/circuit-editor/BenchSurface.tsx client/src/components/circuit-editor/__tests__/BenchSurface.test.tsx
git commit -m "feat(breadboard): add BenchSurface wrapper component with zone detection"
```

---

### Task 4: Integrate BenchSurface into BreadboardView

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx`
- Test: `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx` (modify existing)

**Context:** Wrap the existing BreadboardGrid and component rendering inside BenchSurface. Update the SVG viewBox to use the larger surface dimensions. Adjust pan/zoom to work on the surface level. The breadboard content shifts by `breadboardOrigin` offset.

- [ ] **Step 1: Add test for bench surface rendering**

Add to the existing `BreadboardView.test.tsx`:

```typescript
it('renders bench surface container', () => {
  render(<BreadboardView />, { wrapper: TestWrapper });
  expect(screen.getByTestId('bench-surface')).toBeInTheDocument();
  expect(screen.getByTestId('breadboard-zone')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx -t "renders bench surface"`
Expected: FAIL — no bench-surface testid found

- [ ] **Step 3: Integrate BenchSurface**

In `BreadboardView.tsx`:
1. Import `BenchSurface` and `BENCH_DEFAULTS`
2. Update the main SVG `viewBox` to use `BENCH_DEFAULTS.surfaceWidth`/`surfaceHeight`
3. Wrap `BreadboardGrid` and all overlay content inside `<BenchSurface>`
4. Update `clientToBoardPixel` to account for the breadboard origin offset

Key changes:
- SVG viewBox: `0 0 ${BENCH_DEFAULTS.surfaceWidth} ${BENCH_DEFAULTS.surfaceHeight}`
- All board-space coords offset by `BENCH_DEFAULTS.breadboardOrigin`
- `clientToBoardPixel` subtracts the origin offset before converting

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx && npm run check`
Expected: PASS (existing tests still pass since board content is just offset), zero TS errors

- [ ] **Step 5: Commit**

```bash
git add client/src/components/circuit-editor/BreadboardView.tsx client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx
git commit -m "feat(breadboard): integrate BenchSurface wrapper into BreadboardView"
```

---

### Task 5: Dual placement mode — on-board vs. on-bench

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (handleDrop refactor)
- Modify: `client/src/lib/circuit-editor/breadboard-model.ts` (new placement type)
- Test: `client/src/lib/circuit-editor/__tests__/breadboard-model.test.ts` (extend)

**Context:** Currently `handleDrop` always snaps to a breadboard hole and sets `breadboardX`/`breadboardY`. Now it checks `isWithinBreadboardZone()` — if inside, snap to grid and set breadboard coords. If outside, free-place and set `benchX`/`benchY`. The component renders differently in each mode.

- [ ] **Step 1: Add placement mode type and helper to breadboard-model.ts**

Add test:
```typescript
describe('placement mode detection', () => {
  it('returns board mode for position inside breadboard zone', () => {
    expect(getPlacementMode({ x: 100, y: 100 })).toBe('board');
  });

  it('returns bench mode for position outside breadboard zone', () => {
    expect(getPlacementMode({ x: -50, y: -50 })).toBe('bench');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `getPlacementMode` in breadboard-model.ts**

```typescript
import { isWithinBreadboardZone, type BenchPosition } from '@/components/circuit-editor/BenchSurface';

export type PlacementMode = 'board' | 'bench';

export function getPlacementMode(surfacePos: BenchPosition): PlacementMode {
  return isWithinBreadboardZone(surfacePos) ? 'board' : 'bench';
}
```

- [ ] **Step 4: Run tests, verify pass**
- [ ] **Step 5: Update handleDrop in BreadboardView.tsx**

Refactor `handleDrop` to:
1. Convert drop position to surface coordinates
2. Call `getPlacementMode(surfacePos)`
3. If `'board'`: existing logic (snap to grid, set `breadboardX`/`breadboardY`)
4. If `'bench'`: set `benchX`/`benchY` with raw surface coords, skip collision check

- [ ] **Step 6: Run full suite and commit**

Run: `npm run check && npm test`

```bash
git commit -m "feat(breadboard): implement dual placement mode (on-board vs. on-bench)"
```

---

### Task 6: Render bench-placed components

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (component rendering loop)
- Test: `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`

**Context:** Currently the rendering loop filters `instances.filter(i => i.breadboardX != null)`. Extend to also render instances with `benchX`/`benchY` set — render them at bench coordinates without bendable legs, with a different visual style (subtle outline indicating off-board status, labeled connection points instead of pin-in-hole legs).

- [ ] **Step 1: Write test for bench component rendering**

```typescript
it('renders bench-placed components outside the breadboard zone', () => {
  // Mock instance with benchX/benchY set, breadboardX/breadboardY null
  // Verify it renders with data-testid="bench-component-{id}"
});
```

- [ ] **Step 2-4: Implement and verify**

Extend the component rendering section to:
1. Collect both board-placed and bench-placed instances
2. Render board-placed with existing SVG + bendable legs
3. Render bench-placed with component SVG + labeled pin points (no legs)
4. Different opacity/outline to visually distinguish

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(breadboard): render bench-placed components with visual distinction"
```

---

### Task 7: Bench-to-board jumper wires

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (wire drawing)
- Modify: `client/src/components/circuit-editor/BreadboardWireEditor.tsx` (endpoint types)
- Test: `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`

**Context:** Enable drawing wires between bench-placed component pins and breadboard holes. The wire renders as a jumper cable (thicker stroke, rounded endpoints representing Dupont connectors). Wire creation stores `endpointMeta` JSONB and `provenance: 'jumper'`.

- [ ] **Step 1: Write test for jumper wire rendering**

```typescript
it('renders jumper wire between bench component and breadboard hole', () => {
  // Mock wire with endpointMeta having bench-pin start and hole end
  // Verify jumper wire SVG renders with thicker stroke
});
```

- [ ] **Step 2-4: Implement jumper wire drawing and rendering**

Key implementation:
1. When in wire mode and clicking a bench component's pin, start a jumper wire
2. When the other end lands on a breadboard hole, create wire with `provenance: 'jumper'`
3. Render jumper wires with 3px stroke, rounded linecap, colored connectors at endpoints
4. Store `endpointMeta` with typed endpoint info

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(breadboard): implement bench-to-board jumper wires with endpoint metadata"
```

---

### Task 8: Auto-placement for non-breadboard-friendly boards

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (drop handler)
- Modify: `client/src/lib/breadboard-bench.ts` (fit-based routing)
- Test: `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`

**Context:** When dropping a `not_breadboard_friendly` component (like Mega 2560), automatically place on bench surface with a toast notification. When dropping a `requires_jumpers` component (like ESP32), show a choice dialog: "Plug into breadboard (tight fit) or place on bench?"

- [ ] **Step 1: Write test for auto-routing**

```typescript
it('auto-places not_breadboard_friendly parts on bench', () => {
  // Mock drop of Mega 2560 part (breadboardFit: 'not_breadboard_friendly')
  // Verify benchX/benchY set, breadboardX/breadboardY null
  // Verify toast shown
});

it('shows choice dialog for requires_jumpers parts', () => {
  // Mock drop of ESP32 part (breadboardFit: 'requires_jumpers')
  // Verify dialog appears with two options
});
```

- [ ] **Step 2-4: Implement auto-routing logic**

In `handleDrop`, before placement:
1. Look up the part's `breadboardFit` from meta or verified board pack
2. If `not_breadboard_friendly`: force bench placement, show explanatory toast
3. If `requires_jumpers`: show dialog with bench vs. board options
4. If `native` or undefined: use normal placement mode detection

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(breadboard): auto-route non-breadboard-friendly parts to bench surface"
```

---

## Phase 1: Visual Expansion

### Task 9: Expand SVG component library — first batch (6 new families)

**Files:**
- Create: `client/src/components/circuit-editor/breadboard-components/PotentiometerSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/ButtonSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/SwitchSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/HeaderSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/RegulatorSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/CrystalSvg.tsx`
- Modify: `client/src/components/circuit-editor/BreadboardComponentRenderer.tsx` (extend `detectFamily`)
- Test: `client/src/components/circuit-editor/__tests__/breadboard-components.test.tsx` (extend)

**Context:** Follow the pattern from `ResistorSvg.tsx` (value-driven rendering) and `IcSvg.tsx` (DIP package). Each SVG must render at `BB.PITCH` (10px per 0.1") scale. All are `memo`-wrapped functional components.

**Pattern — each new SVG follows this TDD cycle:**

```typescript
// Test
it('renders PotentiometerSvg with value label', () => {
  const { container } = render(<PotentiometerSvg value="10k" />);
  expect(container.querySelector('svg')).toBeInTheDocument();
  // Check for dial indicator, 3 pins (wiper + 2 terminals)
});

// Implementation
// 3-pin radial component with dial indicator showing wiper position
// Pins: terminal 1, wiper, terminal 2
// Body: circular with knob/arrow indicator
```

- [ ] **Step 1-6: Implement PotentiometerSvg with full TDD cycle**
- [ ] **Step 7-12: Implement ButtonSvg (tactile pushbutton, 4 pins, press state)**
- [ ] **Step 13-18: Implement SwitchSvg (SPDT toggle, 3 pins, on/off state)**
- [ ] **Step 19-24: Implement HeaderSvg (N-pin male/female header strip)**
- [ ] **Step 25-30: Implement RegulatorSvg (TO-220 package, 3 pins, voltage label)**
- [ ] **Step 31-36: Implement CrystalSvg (HC-49 package, 2 pins, frequency label)**
- [ ] **Step 37: Extend detectFamily() to route new types**

Add to `detectFamily()` in `BreadboardComponentRenderer.tsx`:
```typescript
if (lower === 'potentiometer' || lower === 'pot' || lower === 'variable_resistor') return 'potentiometer';
if (lower === 'button' || lower === 'pushbutton' || lower === 'tactile') return 'button';
if (lower === 'switch' || lower === 'toggle' || lower === 'spdt') return 'switch';
if (lower === 'header' || lower === 'pin_header' || lower === 'connector') return 'header';
if (lower === 'regulator' || lower === 'vreg' || lower === 'ldo') return 'regulator';
if (lower === 'crystal' || lower === 'xtal' || lower === 'oscillator') return 'crystal';
```

- [ ] **Step 38: Run full test suite, commit**

```bash
git commit -m "feat(breadboard): add 6 new SVG component families (pot, button, switch, header, regulator, crystal)"
```

---

### Task 10: Expand SVG component library — second batch (7 more families)

**Files:**
- Create: `BuzzerSvg.tsx`, `FuseSvg.tsx`, `RelaySvg.tsx`, `MotorSvg.tsx`, `SensorSvg.tsx`, `DisplaySvg.tsx`, `ConnectorSvg.tsx`
- Modify: `BreadboardComponentRenderer.tsx` (extend `detectFamily`)
- Test: `breadboard-components.test.tsx` (extend)

Same pattern as Task 9. After this task, `detectFamily` routes 20+ type strings to photorealistic SVG renderers.

- [ ] **Steps 1-42: TDD cycle for each SVG (same pattern as Task 9)**
- [ ] **Step 43: Extend detectFamily for remaining types**
- [ ] **Step 44: Run full test suite, commit**

```bash
git commit -m "feat(breadboard): add 7 more SVG component families (buzzer, fuse, relay, motor, sensor, display, connector)"
```

---

### Task 11: Expand verified board profiles — Arduino + RPi Pico

**Files:**
- Create: `shared/verified-boards/arduino-uno-r3.ts`
- Create: `shared/verified-boards/arduino-nano.ts`
- Create: `shared/verified-boards/rpi-pico.ts`
- Modify: `shared/verified-boards/index.ts` (register new boards)
- Test: `shared/verified-boards/__tests__/arduino-uno-r3.test.ts` (NEW)
- Test: `shared/verified-boards/__tests__/arduino-nano.test.ts` (NEW)
- Test: `shared/verified-boards/__tests__/rpi-pico.test.ts` (NEW)

**Context:** Follow the pattern from `nodemcu-esp32s.ts`. Each board needs: physical dimensions, full pin map with electrical roles, `breadboardFit` classification, hardware traps, `breadboardNotes`. ALL data from official datasheets. Use Context7/WebSearch to verify pin assignments.

**MANDATORY: Research before implementation.** Use Context7 to look up Arduino Uno R3 pinout, Nano pinout, and RPi Pico pinout from official documentation. Do NOT rely on training data alone.

**Pattern per board:**

```typescript
// Test
describe('Arduino Uno R3 verified board', () => {
  it('has correct pin count', () => {
    expect(arduinoUnoR3.pins).toHaveLength(32); // 14 digital + 6 analog + power + misc
  });

  it('has correct breadboard fit', () => {
    expect(arduinoUnoR3.breadboardFit).toBe('not_breadboard_friendly');
    // Uno is 68.6mm x 53.4mm — too wide for standard breadboard
  });

  it('flags restricted pins', () => {
    const restricted = arduinoUnoR3.pins.filter(p => p.restricted);
    expect(restricted.length).toBeGreaterThan(0);
    // Pins 0/1 are Serial — should warn about conflicts with USB programming
  });

  it('is findable by alias', () => {
    expect(findVerifiedBoardByAlias('Arduino Uno R3')).toBeDefined();
    expect(findVerifiedBoardByAlias('ATmega328P')).toBeDefined();
  });
});
```

- [ ] **Steps 1-5: Arduino Uno R3 (TDD — research pinout first)**
- [ ] **Steps 6-10: Arduino Nano (TDD — fits breadboard: `requires_jumpers` or `native`)**
- [ ] **Steps 11-15: Raspberry Pi Pico (TDD — fits breadboard: `requires_jumpers`)**
- [ ] **Step 16: Register all 3 in index.ts, run full suite, commit**

```bash
git commit -m "feat(verified-boards): add Arduino Uno R3, Nano, and RPi Pico profiles"
```

---

### Task 12: Expand verified board profiles — STM32 + maker boards

**Files:**
- Create: `shared/verified-boards/stm32-nucleo-64.ts`
- Create: `shared/verified-boards/adafruit-feather.ts`
- Create: `shared/verified-boards/sparkfun-thing-plus.ts`
- Create: `shared/verified-boards/teensy-40.ts`
- Modify: `shared/verified-boards/index.ts`
- Test: One test file per board

Same pattern as Task 11. Research pinouts from official datasheets before implementation.

- [ ] **Steps 1-5: STM32 Nucleo-64**
- [ ] **Steps 6-10: Adafruit Feather (ESP32-S3 variant)**
- [ ] **Steps 11-15: SparkFun Thing Plus**
- [ ] **Steps 16-20: Teensy 4.0**
- [ ] **Step 21: Register all in index.ts, run full suite, commit**

```bash
git commit -m "feat(verified-boards): add STM32 Nucleo, Adafruit Feather, SparkFun Thing Plus, Teensy 4.0 profiles"
```

---

## Post-Implementation

After Phase 0 + Phase 1 are complete:

1. **Verify in browser**: Open Breadboard Lab, verify bench surface renders, drag component to bench area, draw jumper wire, place Mega 2560 (should auto-route to bench)
2. **Run full suite**: `npm run check && npm test` — zero errors, zero failures
3. **Plan next phases**: Phases 2-5 (interaction, intelligence, inventory, sync) depend on Phase 0 being done. Generate separate plans for each when ready.
