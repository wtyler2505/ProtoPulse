# Breadboard Lab Phase 0+1: Bench Surface Foundation & Visual Expansion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **For `/agent-teams`:** This plan has two independent tracks with zero file overlap. Run them as parallel teammates. See Agent Teams section below.

**Goal:** Transform the breadboard canvas from a grid-only editor into a bench surface with smart on-board/on-bench dual placement, then expand the visual component library from 7 to 20+ families and verified board profiles from 3 to 10+.

**Architecture:** Phase 0 refactors BreadboardView into a BenchSurface parent containing a BreadboardGrid child zone, adds `benchX`/`benchY` columns to `circuit_instances` and `endpointMeta`/`provenance` columns to `circuit_wires`, and extends the placement and wire-drawing flows for dual modes. Phase 1 creates new SVG component files and verified board profiles as independent additions.

**Tech Stack:** React 19 + TypeScript 5.6 + Vite 7 + Tailwind v4 + shadcn/ui + Vitest 4 + happy-dom + Drizzle ORM + PostgreSQL

---

## Existing Infrastructure

| Module | File | Status |
|--------|------|--------|
| Breadboard view | `client/src/components/circuit-editor/BreadboardView.tsx` | Production — 2000+ lines, handles placement/wiring/tools |
| Breadboard grid | `client/src/components/circuit-editor/BreadboardGrid.tsx` | Production — SVG grid rendering, hover/highlight |
| Breadboard model | `client/src/lib/circuit-editor/breadboard-model.ts` | Production — 830-point model, collision, coordinates |
| Component renderer | `client/src/components/circuit-editor/BreadboardComponentRenderer.tsx` | Production — 7 families, value-driven |
| SVG components | `client/src/components/circuit-editor/breadboard-components/` | Production — 7 files (Resistor, Cap, LED, IC, Diode, Transistor, Wire) |
| Wire editor | `client/src/components/circuit-editor/BreadboardWireEditor.tsx` | Production — point-to-point drawing |
| Bendable legs | `client/src/lib/circuit-editor/bendable-legs.ts` | Production — bezier curves, per-type colors |
| Verified boards | `shared/verified-boards/` | Production — 3 boards (ESP32, Mega 2560, RioRand) |
| Schema | `shared/schema.ts` | `circuit_instances`: breadboardX/Y nullable real. `circuit_wires`: points jsonb, view text, wireType text |
| Bench insights | `client/src/lib/breadboard-bench.ts` | Production — fit classification, owned/missing tracking |

## Phase Overview

| Phase | Track | Description | Tasks | Agent Team |
|-------|-------|-------------|-------|------------|
| **Phase 0** | A (sequential) | Bench surface spatial model | 1-4 | `bench-surface` teammate |
| **Phase 1** | B (parallel) | SVG library + board profiles | 5-6 | `visual-expansion` teammate |

Phase 0 and Phase 1 have **zero file overlap** and run as parallel `/agent-teams` teammates.

---

## `/agent-teams` Composition

### Team Spawn Prompts

**Teammate: bench-surface**
```
You are implementing the Bench Surface Foundation for ProtoPulse's Breadboard Lab.
Your plan is at docs/superpowers/plans/2026-04-10-breadboard-bench-surface-and-visual-expansion.md — Tasks 1-4.
Execute them sequentially (each depends on the previous).

YOUR FILES (exclusive ownership):
- client/src/components/circuit-editor/BreadboardView.tsx
- client/src/components/circuit-editor/BenchSurface.tsx (CREATE)
- client/src/components/circuit-editor/BreadboardWireEditor.tsx
- client/src/lib/circuit-editor/breadboard-model.ts
- shared/schema.ts (ONLY the benchX/benchY + endpointMeta/provenance additions)
- client/src/lib/circuit-editor/__tests__/bench-surface.test.ts (CREATE)

DO NOT TOUCH: breadboard-components/, verified-boards/, BreadboardComponentRenderer.tsx

After each task: npm run check (must pass), npm test (must pass), commit.
```

**Teammate: visual-expansion**
```
You are expanding ProtoPulse's Breadboard Lab visual library.
Your plan is at docs/superpowers/plans/2026-04-10-breadboard-bench-surface-and-visual-expansion.md — Tasks 5-6.
These tasks are independent of each other and of the bench-surface teammate.

YOUR FILES (exclusive ownership):
- client/src/components/circuit-editor/breadboard-components/ (NEW SVG files only)
- client/src/components/circuit-editor/BreadboardComponentRenderer.tsx (detectFamily extension)
- client/src/components/circuit-editor/__tests__/breadboard-components.test.tsx (extend)
- shared/verified-boards/ (NEW board profile files only)
- shared/verified-boards/__tests__/ (NEW test files)
- shared/verified-boards/index.ts (add exports for new boards)

DO NOT TOUCH: BreadboardView.tsx, breadboard-model.ts, BreadboardWireEditor.tsx, schema.ts

After each task: npm run check (must pass), npm test (must pass), commit.
```

### Team Execution Checklist
- [ ] Context7 + WebSearch research before implementation (board datasheets, Fritzing SVG patterns)
- [ ] `/agent-teams` spawn with prompts above
- [ ] Plan approval from user before agents start
- [ ] Each agent runs: implement → `npm run check` → `npm test` → commit
- [ ] Lead reviews each commit before next task
- [ ] Both agents complete → integration test (full breadboard flow in Chrome DevTools)

---

## Phase 0: Bench Surface Foundation

### Task 1: Schema — Add bench placement and wire endpoint columns (S0-01 + S0-02 partial)

**Files:**
- Modify: `shared/schema.ts` (add columns to `circuit_instances` and `circuit_wires`)
- Test: `server/__tests__/bench-schema.test.ts` (CREATE)

**Context:** `circuit_instances` currently has nullable `breadboardX`/`breadboardY`/`breadboardRotation` for on-board placement. We add nullable `benchX`/`benchY` for on-bench placement. `circuit_wires` currently has `points` (jsonb), `view`, `wireType`. We add `endpointMeta` (jsonb) for typed endpoints and `provenance` (text) for wire origin tracking.

- [ ] **Step 1: Write the schema additions**

In `shared/schema.ts`, add to `circuitInstances` table definition (after `breadboardRotation`):

```typescript
benchX: real("bench_x"),
benchY: real("bench_y"),
```

In `circuitWires` table definition (after `wireType`):

```typescript
endpointMeta: jsonb("endpoint_meta"),
provenance: text("provenance").default("manual"),
```

- [ ] **Step 2: Write the failing test**

Create `server/__tests__/bench-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { circuitInstances, circuitWires, insertCircuitInstanceSchema, insertCircuitWireSchema } from '@shared/schema';

describe('bench surface schema additions', () => {
  it('circuit_instances has benchX and benchY columns', () => {
    expect(circuitInstances.benchX).toBeDefined();
    expect(circuitInstances.benchY).toBeDefined();
  });

  it('circuit_wires has endpointMeta and provenance columns', () => {
    expect(circuitWires.endpointMeta).toBeDefined();
    expect(circuitWires.provenance).toBeDefined();
  });

  it('insertCircuitInstanceSchema accepts benchX/benchY', () => {
    const result = insertCircuitInstanceSchema.safeParse({
      circuitId: 1,
      referenceDesignator: 'U1',
      benchX: 100,
      benchY: 200,
    });
    expect(result.success).toBe(true);
  });

  it('insertCircuitWireSchema accepts provenance', () => {
    const result = insertCircuitWireSchema.safeParse({
      circuitId: 1,
      netId: 1,
      view: 'breadboard',
      provenance: 'coach',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run server/__tests__/bench-schema.test.ts --project server`
Expected: PASS (schema additions are immediate)

- [ ] **Step 4: Push schema to database**

Run: `npm run db:push`
Expected: New columns added to circuit_instances and circuit_wires tables.

- [ ] **Step 5: Run full type check and test suite**

Run: `npm run check && npm test`
Expected: Zero errors. Existing tests unaffected (new columns are nullable with defaults).

- [ ] **Step 6: Commit**

```bash
git add shared/schema.ts server/__tests__/bench-schema.test.ts
git commit -m "feat(breadboard): add benchX/benchY and endpointMeta/provenance schema columns

Adds nullable bench placement columns to circuit_instances and wire
endpoint metadata + provenance tracking to circuit_wires. Foundation
for the bench surface spatial model (S0-01/S0-02)."
```

---

### Task 2: BenchSurface container — extract breadboard grid as a zone (S0-01)

**Files:**
- Create: `client/src/components/circuit-editor/BenchSurface.tsx`
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (wrap grid in BenchSurface)
- Test: `client/src/lib/circuit-editor/__tests__/bench-surface.test.ts` (CREATE)

**Context:** BreadboardView.tsx currently renders a single SVG where the breadboard grid IS the canvas. We need to wrap the grid in a larger surface. BenchSurface renders the full workspace SVG. BreadboardGrid becomes a positioned child within it. The BenchSurface handles pan/zoom for the whole surface and defines the snap-proximity threshold.

- [ ] **Step 1: Write the failing test for BenchSurface**

Create `client/src/lib/circuit-editor/__tests__/bench-surface.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getBenchSurfaceDimensions,
  getBreadboardZone,
  isWithinSnapThreshold,
  type BenchSurfaceConfig,
} from '@/lib/circuit-editor/bench-surface-model';

describe('bench-surface-model', () => {
  const config: BenchSurfaceConfig = {
    boardWidth: 700,
    boardHeight: 230,
    benchPadding: 200,
    snapThreshold: 40,
  };

  describe('getBenchSurfaceDimensions', () => {
    it('returns surface larger than breadboard by padding', () => {
      const dims = getBenchSurfaceDimensions(config);
      expect(dims.width).toBe(700 + 200 * 2); // 1100
      expect(dims.height).toBe(230 + 200 * 2); // 630
    });
  });

  describe('getBreadboardZone', () => {
    it('returns breadboard position centered in surface', () => {
      const zone = getBreadboardZone(config);
      expect(zone.x).toBe(200); // padding
      expect(zone.y).toBe(200); // padding
      expect(zone.width).toBe(700);
      expect(zone.height).toBe(230);
    });
  });

  describe('isWithinSnapThreshold', () => {
    it('returns true for point inside breadboard zone', () => {
      expect(isWithinSnapThreshold(350, 315, config)).toBe(true);
    });

    it('returns true for point within threshold of zone edge', () => {
      expect(isWithinSnapThreshold(165, 315, config)).toBe(true); // 35px from left edge
    });

    it('returns false for point beyond threshold', () => {
      expect(isWithinSnapThreshold(50, 315, config)).toBe(false); // 150px from left edge
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/circuit-editor/__tests__/bench-surface.test.ts --project client`
Expected: FAIL — module not found

- [ ] **Step 3: Implement bench-surface-model.ts**

Create `client/src/lib/circuit-editor/bench-surface-model.ts`:

```typescript
import { BB, getBoardDimensions } from './breadboard-model';

export interface BenchSurfaceConfig {
  boardWidth: number;
  boardHeight: number;
  benchPadding: number;
  snapThreshold: number;
}

export interface SurfaceDimensions {
  width: number;
  height: number;
}

export interface BreadboardZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getDefaultBenchConfig(): BenchSurfaceConfig {
  const boardDims = getBoardDimensions();
  return {
    boardWidth: boardDims.width,
    boardHeight: boardDims.height,
    benchPadding: 200,
    snapThreshold: 40,
  };
}

export function getBenchSurfaceDimensions(config: BenchSurfaceConfig): SurfaceDimensions {
  return {
    width: config.boardWidth + config.benchPadding * 2,
    height: config.boardHeight + config.benchPadding * 2,
  };
}

export function getBreadboardZone(config: BenchSurfaceConfig): BreadboardZone {
  return {
    x: config.benchPadding,
    y: config.benchPadding,
    width: config.boardWidth,
    height: config.boardHeight,
  };
}

export function isWithinSnapThreshold(
  surfaceX: number,
  surfaceY: number,
  config: BenchSurfaceConfig,
): boolean {
  const zone = getBreadboardZone(config);
  const expandedLeft = zone.x - config.snapThreshold;
  const expandedTop = zone.y - config.snapThreshold;
  const expandedRight = zone.x + zone.width + config.snapThreshold;
  const expandedBottom = zone.y + zone.height + config.snapThreshold;

  return (
    surfaceX >= expandedLeft &&
    surfaceX <= expandedRight &&
    surfaceY >= expandedTop &&
    surfaceY <= expandedBottom
  );
}

export function surfaceToBoardCoords(
  surfaceX: number,
  surfaceY: number,
  config: BenchSurfaceConfig,
): { x: number; y: number } {
  const zone = getBreadboardZone(config);
  return {
    x: surfaceX - zone.x,
    y: surfaceY - zone.y,
  };
}

export function boardToSurfaceCoords(
  boardX: number,
  boardY: number,
  config: BenchSurfaceConfig,
): { x: number; y: number } {
  const zone = getBreadboardZone(config);
  return {
    x: boardX + zone.x,
    y: boardY + zone.y,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/circuit-editor/__tests__/bench-surface.test.ts --project client`
Expected: PASS

- [ ] **Step 5: Run full check and test suite**

Run: `npm run check && npm test`
Expected: Zero errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/circuit-editor/bench-surface-model.ts client/src/lib/circuit-editor/__tests__/bench-surface.test.ts
git commit -m "feat(breadboard): add bench surface spatial model

Pure-function model for the bench surface: dimensions, breadboard zone
positioning, snap-threshold detection, coordinate transforms between
surface and board space. Foundation for S0-01."
```

---

### Task 3: Dual placement mode — on-board vs. on-bench drop handling (S0-02)

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (handleDrop refactor)
- Modify: `client/src/lib/circuit-editor/breadboard-model.ts` (extend placement types)
- Test: `client/src/lib/circuit-editor/__tests__/bench-surface.test.ts` (extend)

**Context:** Currently `handleDrop` in BreadboardView always snaps to a breadboard hole. With the bench surface, drops within the snap threshold snap to holes (existing behavior). Drops outside the threshold free-place on the bench surface, setting `benchX`/`benchY` instead of `breadboardX`/`breadboardY`. Components marked `not_breadboard_friendly` auto-route to bench placement.

- [ ] **Step 1: Write tests for placement mode determination**

Extend `bench-surface.test.ts`:

```typescript
import {
  determinePlacementMode,
  type PlacementMode,
} from '@/lib/circuit-editor/bench-surface-model';

describe('determinePlacementMode', () => {
  const config = {
    boardWidth: 700,
    boardHeight: 230,
    benchPadding: 200,
    snapThreshold: 40,
  };

  it('returns "board" for drop within snap threshold', () => {
    expect(determinePlacementMode(350, 315, 'native', config)).toBe('board');
  });

  it('returns "bench" for drop outside snap threshold', () => {
    expect(determinePlacementMode(50, 50, 'native', config)).toBe('bench');
  });

  it('returns "bench" for not_breadboard_friendly regardless of position', () => {
    expect(determinePlacementMode(350, 315, 'not_breadboard_friendly', config)).toBe('bench');
  });

  it('returns "board" for requires_jumpers within snap threshold', () => {
    expect(determinePlacementMode(350, 315, 'requires_jumpers', config)).toBe('board');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/circuit-editor/__tests__/bench-surface.test.ts --project client`
Expected: FAIL — `determinePlacementMode` not found

- [ ] **Step 3: Implement determinePlacementMode**

Add to `bench-surface-model.ts`:

```typescript
export type PlacementMode = 'board' | 'bench';

type FitClassification = 'native' | 'requires_jumpers' | 'not_breadboard_friendly' | string;

export function determinePlacementMode(
  surfaceX: number,
  surfaceY: number,
  breadboardFit: FitClassification,
  config: BenchSurfaceConfig,
): PlacementMode {
  if (breadboardFit === 'not_breadboard_friendly') {
    return 'bench';
  }
  return isWithinSnapThreshold(surfaceX, surfaceY, config) ? 'board' : 'bench';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/circuit-editor/__tests__/bench-surface.test.ts --project client`
Expected: PASS

- [ ] **Step 5: Integrate into BreadboardView.tsx handleDrop**

Refactor `handleDrop` in BreadboardView.tsx to use `determinePlacementMode()`. When mode is `'board'`, existing snap-to-hole logic runs and sets `breadboardX`/`breadboardY`. When mode is `'bench'`, set `benchX`/`benchY` to the surface coordinates. Add a toast for bench placement: "Placed on bench — draw jumper wires to connect."

- [ ] **Step 6: Run full check and test suite**

Run: `npm run check && npm test`
Expected: Zero errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/circuit-editor/bench-surface-model.ts client/src/lib/circuit-editor/__tests__/bench-surface.test.ts client/src/components/circuit-editor/BreadboardView.tsx
git commit -m "feat(breadboard): dual placement mode — on-board vs. on-bench

Components dropped within snap threshold of the breadboard snap to
holes (existing behavior). Components dropped on the bench surface or
marked not_breadboard_friendly free-place with benchX/benchY. S0-02."
```

---

### Task 4: Bench-to-board jumper wires and auto-placement (S0-03 + S0-04)

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardView.tsx` (wire drawing for bench endpoints)
- Modify: `client/src/components/circuit-editor/BreadboardWireEditor.tsx` (bench pin endpoints)
- Modify: `client/src/lib/circuit-editor/breadboard-model.ts` (extend wire endpoint types)
- Test: `client/src/lib/circuit-editor/__tests__/bench-surface.test.ts` (extend for wire endpoints)

**Context:** The wire editor currently only handles board-to-board wire drawing (both endpoints on breadboard holes). We need to support: board-to-bench (hole to component pin), bench-to-bench (pin to pin), and bench-to-board (pin to hole). Wire `endpointMeta` stores typed endpoint info. `circuit_wires.points` continues to store the visual path. When a Mega 2560 is dropped, it auto-places on the bench with connection point indicators.

- [ ] **Step 1: Write tests for wire endpoint types**

Add to `bench-surface.test.ts`:

```typescript
import {
  createHoleEndpoint,
  createBenchPinEndpoint,
  isJumperWire,
  type WireEndpoint,
} from '@/lib/circuit-editor/bench-surface-model';

describe('wire endpoints', () => {
  it('creates a hole endpoint', () => {
    const ep = createHoleEndpoint('a', 5);
    expect(ep.type).toBe('hole');
    expect(ep.col).toBe('a');
    expect(ep.row).toBe(5);
  });

  it('creates a bench pin endpoint', () => {
    const ep = createBenchPinEndpoint(42, 'GPIO5');
    expect(ep.type).toBe('bench-pin');
    expect(ep.instanceId).toBe(42);
    expect(ep.pinId).toBe('GPIO5');
  });

  it('identifies jumper wire (mixed endpoint types)', () => {
    const hole = createHoleEndpoint('a', 5);
    const pin = createBenchPinEndpoint(42, 'GPIO5');
    expect(isJumperWire(hole, pin)).toBe(true);
    expect(isJumperWire(hole, hole)).toBe(false);
    expect(isJumperWire(pin, pin)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/circuit-editor/__tests__/bench-surface.test.ts --project client`
Expected: FAIL — functions not found

- [ ] **Step 3: Implement wire endpoint types**

Add to `bench-surface-model.ts`:

```typescript
export type WireEndpoint =
  | { type: 'hole'; col: string; row: number }
  | { type: 'bench-pin'; instanceId: number; pinId: string };

export function createHoleEndpoint(col: string, row: number): WireEndpoint {
  return { type: 'hole', col, row };
}

export function createBenchPinEndpoint(instanceId: number, pinId: string): WireEndpoint {
  return { type: 'bench-pin', instanceId, pinId };
}

export function isJumperWire(start: WireEndpoint, end: WireEndpoint): boolean {
  return start.type !== end.type;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run client/src/lib/circuit-editor/__tests__/bench-surface.test.ts --project client`
Expected: PASS

- [ ] **Step 5: Wire BreadboardView.tsx rendering for bench-placed components**

Add rendering logic: components with `benchX`/`benchY` (and null `breadboardX`/`breadboardY`) render at their bench surface coordinates outside the breadboard grid, with a distinct visual style (lighter border, "bench" badge). Connection points shown as small circles at pin positions.

- [ ] **Step 6: Wire auto-placement for not_breadboard_friendly**

When dropping a component whose `breadboardFit` is `not_breadboard_friendly`, auto-place on the bench surface to the left of the breadboard. Show toast: "[Board name] placed on the bench — it's too wide for the breadboard. Draw jumper wires to connect its pins."

- [ ] **Step 7: Run full check and test suite**

Run: `npm run check && npm test`
Expected: Zero errors, all tests pass.

- [ ] **Step 8: Verify in Chrome DevTools**

Open breadboard tab. Drop a starter MCU → should snap to board. Verify an instance with `not_breadboard_friendly` renders on the bench area (mock by setting properties in dev console). Verify wire drawing still works for on-board components.

- [ ] **Step 9: Commit**

```bash
git add -A  # bench-surface-model.ts, BreadboardView.tsx, BreadboardWireEditor.tsx, tests
git commit -m "feat(breadboard): bench-to-board jumper wires and auto-placement

Bench-placed components render outside the breadboard grid with
connection point indicators. Wire endpoints support hole and bench-pin
types. Components marked not_breadboard_friendly auto-place on bench.
Completes S0-03 and S0-04."
```

---

## Phase 1: Visual Expansion (runs in parallel with Phase 0)

### Task 5: Expand SVG component library — 13 new families (S1-01)

**Files:**
- Create: `client/src/components/circuit-editor/breadboard-components/PotentiometerSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/ButtonSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/SwitchSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/HeaderSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/RegulatorSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/CrystalSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/BuzzerSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/FuseSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/SensorSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/DisplaySvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/RelaySvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/MotorSvg.tsx`
- Create: `client/src/components/circuit-editor/breadboard-components/ConnectorSvg.tsx`
- Modify: `client/src/components/circuit-editor/BreadboardComponentRenderer.tsx` (extend `detectFamily`)
- Extend: `client/src/components/circuit-editor/__tests__/breadboard-components.test.tsx`

**Context:** Follow the pattern established by `ResistorSvg.tsx` (photorealistic, value-driven, scaled to BB.PITCH = 10px per 0.1"). Each SVG is a `memo` React component accepting value props. The `detectFamily()` function in BreadboardComponentRenderer routes type strings to the correct renderer. Existing families: resistor, capacitor, inductor, led, ic, diode, transistor.

**Pattern to follow (from ResistorSvg.tsx):**
1. Define value-driven rendering (e.g., potentiometer dial position, button pressed/released state)
2. Scale to breadboard pitch (BB.PITCH = 10px)
3. Use realistic colors and shapes
4. Export as `memo` component
5. Add type string(s) to `detectFamily()` routing

- [ ] **Step 1: Write failing tests for new component families**

Extend `breadboard-components.test.tsx` with tests for each new family. Pattern per family:

```typescript
describe('PotentiometerSvg', () => {
  it('renders without crashing', () => {
    const { container } = render(<PotentiometerSvg value={10000} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders dial indicator for value', () => {
    const { container } = render(<PotentiometerSvg value={5000} />);
    // Dial element should exist
    expect(container.querySelector('[data-testid="pot-dial"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Implement each SVG component**

Create each file following the ResistorSvg pattern. Key details per family:

| Family | Key Visual Feature | Pin Count | Pitch |
|--------|-------------------|-----------|-------|
| Potentiometer | Rotary dial with value indicator | 3 | Radial, 0.2" spacing |
| Button | Tactile switch, pressed/released state | 4 (2 pairs) | 0.3" across channel |
| Switch | Toggle position indicator | 2-3 | 0.2" spacing |
| Header | Row of pins with housing color | 2-40 | 0.1" pitch |
| Regulator | TO-220 package with voltage label | 3 | 0.1" pitch |
| Crystal | Metal can with frequency label | 2 | 0.2" spacing |
| Buzzer | Round body with polarity mark | 2 | 0.3" spacing |
| Fuse | Glass body with rating label | 2 | Axial like resistor |
| Sensor | Generic module with label | 3-4 | 0.1" pitch |
| Display | LCD/OLED rectangle with digit area | 4-16 | 0.1" pitch |
| Relay | Box body with coil/contact labels | 5-8 | DIP-like |
| Motor | Circle body with shaft indicator | 2 | 0.3" spacing |
| Connector | Barrel/terminal with wire indicators | 2-3 | 0.2" spacing |

- [ ] **Step 3: Extend detectFamily() in BreadboardComponentRenderer.tsx**

Add routing for all new type strings:

```typescript
export function detectExtendedFamily(type: string | undefined | null): ExtendedComponentType | null {
  if (!type) return null;
  const lower = type.toLowerCase();
  // Existing families...
  if (lower === 'potentiometer' || lower === 'pot' || lower === 'trimmer') return 'potentiometer';
  if (lower === 'button' || lower === 'pushbutton' || lower === 'tactile') return 'button';
  if (lower === 'switch' || lower === 'toggle' || lower === 'spdt' || lower === 'spst') return 'switch';
  if (lower === 'header' || lower === 'pin_header' || lower === 'connector_header') return 'header';
  if (lower === 'regulator' || lower === 'vreg' || lower === 'ldo') return 'regulator';
  if (lower === 'crystal' || lower === 'oscillator' || lower === 'xtal') return 'crystal';
  if (lower === 'buzzer' || lower === 'speaker' || lower === 'piezo') return 'buzzer';
  if (lower === 'fuse') return 'fuse';
  if (lower === 'sensor' || lower === 'thermistor' || lower === 'photoresistor') return 'sensor';
  if (lower === 'display' || lower === 'lcd' || lower === 'oled' || lower === 'segment') return 'display';
  if (lower === 'relay') return 'relay';
  if (lower === 'motor' || lower === 'servo' || lower === 'stepper') return 'motor';
  if (lower === 'connector' || lower === 'terminal' || lower === 'barrel_jack') return 'connector';
  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run client/src/components/circuit-editor/__tests__/breadboard-components.test.tsx --project client`
Expected: PASS

- [ ] **Step 5: Run full check and test suite**

Run: `npm run check && npm test`
Expected: Zero errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/circuit-editor/breadboard-components/ client/src/components/circuit-editor/BreadboardComponentRenderer.tsx client/src/components/circuit-editor/__tests__/breadboard-components.test.tsx
git commit -m "feat(breadboard): expand SVG component library from 7 to 20 families

Adds photorealistic SVG renderers for potentiometer, button, switch,
header, regulator, crystal, buzzer, fuse, sensor, display, relay,
motor, and connector. Each scaled to breadboard pitch with value-driven
rendering. S1-01."
```

---

### Task 6: Expand verified board profiles — 7 new dev boards (S1-02)

**Files:**
- Create: `shared/verified-boards/arduino-uno-r3.ts`
- Create: `shared/verified-boards/arduino-nano.ts`
- Create: `shared/verified-boards/rpi-pico.ts`
- Create: `shared/verified-boards/stm32-nucleo-64.ts`
- Create: `shared/verified-boards/adafruit-feather.ts`
- Create: `shared/verified-boards/sparkfun-thing-plus.ts`
- Create: `shared/verified-boards/teensy-40.ts`
- Modify: `shared/verified-boards/index.ts` (add exports)
- Create: `shared/verified-boards/__tests__/arduino-uno-r3.test.ts` (and similar for each)

**Context:** Follow the pattern established by `shared/verified-boards/nodemcu-esp32s.ts`. Each board profile requires: physical dimensions, full pin map with electrical roles and restrictions, `breadboardFit` classification, hardware traps (strapping pins, restricted GPIOs, boot warnings), `breadboardNotes`. **MANDATORY: use Context7 and/or WebSearch to source all data from official datasheets.** Do not guess pin assignments.

**Research before implementation:**
- [ ] Context7: Arduino Uno R3 pinout and dimensions
- [ ] Context7: Raspberry Pi Pico pinout and dimensions
- [ ] WebSearch: STM32 Nucleo-64 pinout reference (multiple Nucleo variants exist — use the F401RE as the canonical profile)
- [ ] WebSearch: Adafruit Feather pinout (use the Feather M0 as canonical)

- [ ] **Step 1: Write failing tests for each board (pattern)**

Create `shared/verified-boards/__tests__/arduino-uno-r3.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { arduinoUnoR3 } from '../arduino-uno-r3';

describe('Arduino Uno R3 verified board', () => {
  it('has correct board dimensions', () => {
    expect(arduinoUnoR3.dimensions.widthMm).toBeCloseTo(68.6, 0);
    expect(arduinoUnoR3.dimensions.heightMm).toBeCloseTo(53.4, 0);
  });

  it('has correct pin count', () => {
    expect(arduinoUnoR3.pins).toHaveLength(32); // 14 digital + 6 analog + power + ICSP
  });

  it('classifies breadboard fit correctly', () => {
    expect(arduinoUnoR3.breadboardFit).toBe('not_breadboard_friendly');
    // Uno is too wide (53.4mm > standard breadboard width)
  });

  it('identifies pins with restrictions', () => {
    const pin0 = arduinoUnoR3.pins.find(p => p.name === 'D0');
    expect(pin0?.warnings).toContain('Shared with USB serial (Serial/RX)');
  });

  it('has family set to mcu', () => {
    expect(arduinoUnoR3.family).toBe('mcu');
  });

  it('has evidence from official datasheet', () => {
    expect(arduinoUnoR3.evidence.length).toBeGreaterThan(0);
  });
});
```

Repeat pattern for each board with board-specific assertions.

- [ ] **Step 2: Implement each board profile**

Follow `nodemcu-esp32s.ts` structure exactly. Key data per board:

| Board | Fit | Pin Count | Key Traps |
|-------|-----|-----------|-----------|
| Arduino Uno R3 | not_breadboard_friendly (53.4mm wide) | 32 | D0/D1 shared with USB serial, 5V logic |
| Arduino Nano | native (fits perfectly) | 30 | D0/D1 serial, 5V logic, no voltage regulation on Vin > 12V |
| RPi Pico | native (fits with 1 free col per side) | 40 | GP0-GP28 = 3.3V logic ONLY, no 5V tolerance |
| STM32 Nucleo-64 | not_breadboard_friendly (70mm wide) | 76 | Morpho+Arduino headers, 3.3V logic |
| Adafruit Feather | native (narrow form factor) | 28 | 3.3V logic, battery pin |
| SparkFun Thing Plus | native (Feather-compatible) | 28 | ESP32-based — inherits flash GPIO traps |
| Teensy 4.0 | native (narrow, 0.6" wide) | 40 | 3.3V logic, 600MHz ARM, back-side pads |

- [ ] **Step 3: Register in index.ts**

Add exports and alias registration for each new board in `shared/verified-boards/index.ts`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run shared/verified-boards/__tests__/ --project server`
Expected: PASS for all board profiles.

- [ ] **Step 5: Run full check and test suite**

Run: `npm run check && npm test`
Expected: Zero errors.

- [ ] **Step 6: Commit**

```bash
git add shared/verified-boards/
git commit -m "feat(breadboard): add 7 verified board profiles (Uno, Nano, Pico, Nucleo, Feather, Thing Plus, Teensy)

Datasheet-sourced profiles with full pin maps, hardware traps,
breadboard fit classifications, and dimension data. Expands verified
board library from 3 to 10. S1-02."
```

---

## Deferred Phases

Phases 2-5 (interaction, intelligence, inventory, sync/interop) depend on Phase 0 being complete. Their detailed plans will be written after Phase 0 ships and assumptions are validated. See the full spec at `docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md` for the items covered by future plans.
