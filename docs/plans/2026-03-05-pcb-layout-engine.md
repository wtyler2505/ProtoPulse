# FG-01: Production PCB Layout Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-quality PCB layout editor with real footprints, copper routing, layer stack management, trace editing, and via placement — transforming the current placeholder PCB view into a functional layout tool that unblocks 10 downstream checklist items (FG-04, FG-07, FG-10, FG-11, FG-16, FG-17, FG-18, FG-20, EN-04, EN-06).

**Architecture:** Extend the existing PCB layout infrastructure (PCBBoardRenderer, LayerManager, TraceRenderer, PCBInteractionManager, PCBCoordinateSystem, ComponentPlacer) with real footprint geometry from the component type system, a proper via entity model, interactive trace routing with DRC enforcement, and integration with the existing copper pour, board stackup, DFM checker, and export generators. All PCB data persists through the existing circuit schema (circuitInstances, circuitNets, circuitWires).

**Tech Stack:** React 19 + TypeScript 5.6 + SVG rendering + existing board-stackup.ts + drc-engine.ts + copper-pour.ts + component-types.ts + Vitest

---

## Existing Infrastructure Summary

| Module | File | Lines | Status |
|--------|------|-------|--------|
| PCB renderer | `client/src/components/views/pcb-layout/PCBBoardRenderer.tsx` | 213 | Working — placeholder footprints (8x12 rectangles) |
| Trace renderer | `client/src/components/views/pcb-layout/TraceRenderer.tsx` | 162 | Working — front/back layer rendering |
| Layer manager | `client/src/components/views/pcb-layout/LayerManager.ts` | 76 | Working — front/back, visibility, trace widths |
| Coordinate system | `client/src/components/views/pcb-layout/PCBCoordinateSystem.ts` | 119 | Working — screen/board transforms, grid snap |
| Interaction manager | `client/src/components/views/pcb-layout/PCBInteractionManager.ts` | 213 | Working — click/drag/trace/delete |
| Component placer | `client/src/components/views/pcb-layout/ComponentPlacer.ts` | 123 | Working — ratsnest, placement validation |
| DRC overlay | `client/src/components/views/pcb-layout/DrcConstraintOverlay.tsx` | 375 | Working — clearance rings, violations |
| Board stackup | `client/src/lib/board-stackup.ts` | 1,040 | Complete — layers, impedance calc, presets |
| Copper pour | `client/src/lib/copper-pour.ts` | 1,305 | Complete — zone fill, thermal relief, hatched |
| DRC engine | `shared/drc-engine.ts` | 465+ | Complete — 11+ rules, spatial grid |
| DFM checker | `client/src/lib/dfm-checker.ts` | 300+ | Complete — 15 rules, 4 fab presets |
| Component types | `shared/component-types.ts` | 213 | Complete — PadSpec, Connector, PartViews |
| Wire router | `client/src/lib/circuit-editor/wire-router.ts` | 100+ | Partial — A* breadboard only |
| Autoroute | `server/circuit-routes/autoroute.ts` | 137 | Stub — point-to-point only |
| Gerber export | `server/export/gerber-generator.ts` | 1,309 | Complete — RS-274X |
| Drill export | `server/export/drill-generator.ts` | 280 | Complete — Excellon |
| Schema | `shared/schema.ts` | circuitWires has `layer`, `points[]`, `width` | Complete |

## Phase Overview

This plan is split into 5 phases, each independently shippable:

| Phase | Description | Tasks | Unblocks |
|-------|-------------|-------|----------|
| **Phase 1** | Footprint geometry + pad rendering | 1-4 | Foundation for everything |
| **Phase 2** | Via entity model + layer transitions | 5-7 | FG-17, FG-18 |
| **Phase 3** | Interactive trace routing with DRC | 8-11 | EN-06, FG-07 |
| **Phase 4** | Maze router (A* with DRC avoidance) | 12-14 | FG-04, EN-04 |
| **Phase 5** | Integration (export, copper pour, 3D) | 15-17 | FG-07, FG-10 |

---

## Phase 1: Real Footprint Geometry

### Task 1: Footprint Renderer — Pad Geometry Types

**Files:**
- Create: `client/src/lib/pcb/footprint-library.ts`
- Test: `client/src/lib/__tests__/footprint-library.test.ts`

**Context:** Currently all components render as 8x12 rectangles in PCBBoardRenderer.tsx. We need real pad geometry. The `PadSpec` interface in `shared/component-types.ts` defines pad shapes (circle, rect, oblong, square) with THT/SMD types. We need a footprint library that maps common packages to actual pad layouts.

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { FootprintLibrary, type Footprint, type Pad } from '@/lib/pcb/footprint-library';

describe('FootprintLibrary', () => {
  describe('getFootprint', () => {
    it('returns DIP-8 footprint with 8 THT pads', () => {
      const fp = FootprintLibrary.getFootprint('DIP-8');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(8);
      expect(fp!.pads[0].type).toBe('tht');
      expect(fp!.pads[0].shape).toBe('oblong');
      expect(fp!.pads[0].drill).toBeGreaterThan(0);
    });

    it('returns SOT-23 footprint with 3 SMD pads', () => {
      const fp = FootprintLibrary.getFootprint('SOT-23');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(3);
      expect(fp!.pads[0].type).toBe('smd');
    });

    it('returns null for unknown package', () => {
      expect(FootprintLibrary.getFootprint('NONEXISTENT')).toBeNull();
    });

    it('generates footprint from PadSpec connectors', () => {
      const fp = FootprintLibrary.generateFromConnectors([
        { id: '1', name: '1', padSpec: { type: 'smd', shape: 'rect', width: 1.2, height: 0.6 }, position: { x: 0, y: 0 } },
        { id: '2', name: '2', padSpec: { type: 'smd', shape: 'rect', width: 1.2, height: 0.6 }, position: { x: 2.54, y: 0 } },
      ]);
      expect(fp.pads).toHaveLength(2);
      expect(fp.boundingBox.width).toBeCloseTo(3.74); // 2.54 + 1.2
    });
  });

  describe('built-in packages', () => {
    const packages = [
      'DIP-8', 'DIP-14', 'DIP-16', 'DIP-28', 'DIP-40',
      'SOIC-8', 'SOIC-14', 'SOIC-16',
      'SOT-23', 'SOT-223',
      'QFP-44', 'QFP-64', 'QFP-100',
      'TO-220', 'TO-252',
      '0402', '0603', '0805', '1206', '2512',
      'SMA', 'SMB', 'SMC',
    ];

    it.each(packages)('has valid footprint for %s', (pkg) => {
      const fp = FootprintLibrary.getFootprint(pkg);
      expect(fp).not.toBeNull();
      expect(fp!.pads.length).toBeGreaterThan(0);
      expect(fp!.boundingBox.width).toBeGreaterThan(0);
      expect(fp!.boundingBox.height).toBeGreaterThan(0);
      for (const pad of fp!.pads) {
        expect(pad.number).toBeDefined();
        expect(pad.position).toBeDefined();
        if (pad.type === 'tht') {
          expect(pad.drill).toBeGreaterThan(0);
        }
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/__tests__/footprint-library.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// client/src/lib/pcb/footprint-library.ts

export type PadType = 'tht' | 'smd';
export type PadShape = 'circle' | 'rect' | 'oblong' | 'square' | 'roundrect';

export interface Pad {
  number: string; // pad number/name (e.g., '1', 'A1', 'GND')
  type: PadType;
  shape: PadShape;
  position: { x: number; y: number }; // mm, relative to footprint origin
  width: number; // mm
  height: number; // mm
  drill?: number; // mm (THT only)
  drillShape?: 'round' | 'slot'; // THT only
  layer: 'front' | 'back' | 'both'; // SMD on one side, THT on both
  netId?: string; // assigned net (set during placement)
  thermalRelief?: boolean;
  solderMaskExpansion?: number; // mm
  solderPasteMargin?: number; // mm
  cornerRadius?: number; // mm (roundrect only)
}

export interface Footprint {
  packageType: string;
  description: string;
  pads: Pad[];
  courtyard: { x: number; y: number; width: number; height: number }; // mm
  boundingBox: { x: number; y: number; width: number; height: number };
  silkscreen: SilkscreenElement[];
  mountingType: 'tht' | 'smd';
  pinCount: number;
}

export interface SilkscreenElement {
  type: 'line' | 'rect' | 'circle' | 'arc' | 'text';
  // line: x1,y1,x2,y2
  // rect: x,y,width,height
  // circle: cx,cy,radius
  // arc: cx,cy,radius,startAngle,endAngle
  // text: x,y,text,fontSize
  params: Record<string, number | string>;
  lineWidth: number; // mm
}

export interface ConnectorInput {
  id: string;
  name: string;
  padSpec?: { type: PadType; shape: string; width?: number; height?: number; diameter?: number; drill?: number };
  position: { x: number; y: number };
}

// Built-in footprint database — ~25 common packages
// All dimensions in mm, origin at component center
// Pin 1 at top-left for ICs, cathode-mark end for discretes

export class FootprintLibrary {
  private static readonly db: Map<string, Footprint> = new Map();
  private static initialized = false;

  private static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // DIP packages (dual in-line, 2.54mm pitch, 7.62mm or 15.24mm row spacing)
    for (const [name, pinCount, rowSpacing] of [
      ['DIP-8', 8, 7.62], ['DIP-14', 14, 7.62], ['DIP-16', 16, 7.62],
      ['DIP-28', 28, 15.24], ['DIP-40', 40, 15.24],
    ] as const) {
      this.db.set(name, this.makeDIP(name, pinCount, rowSpacing));
    }

    // SOIC packages (1.27mm pitch, 5.3mm body)
    for (const [name, pinCount] of [
      ['SOIC-8', 8], ['SOIC-14', 14], ['SOIC-16', 16],
    ] as const) {
      this.db.set(name, this.makeSOIC(name, pinCount));
    }

    // SOT packages
    this.db.set('SOT-23', this.makeSOT23());
    this.db.set('SOT-223', this.makeSOT223());

    // QFP packages (0.8mm pitch for QFP-44, 0.5mm for larger)
    for (const [name, pinCount, pitch] of [
      ['QFP-44', 44, 0.8], ['QFP-64', 64, 0.5], ['QFP-100', 100, 0.5],
    ] as const) {
      this.db.set(name, this.makeQFP(name, pinCount, pitch));
    }

    // TO packages
    this.db.set('TO-220', this.makeTO220());
    this.db.set('TO-252', this.makeTO252());

    // Chip resistors/capacitors (2-pad SMD)
    for (const [name, length, width, padW, padH] of [
      ['0402', 1.0, 0.5, 0.5, 0.5],
      ['0603', 1.6, 0.8, 0.8, 0.8],
      ['0805', 2.0, 1.25, 1.0, 1.25],
      ['1206', 3.2, 1.6, 1.2, 1.6],
      ['2512', 6.3, 3.2, 1.5, 3.2],
    ] as const) {
      this.db.set(name, this.makeChipComponent(name, length, width, padW, padH));
    }

    // Diode packages
    this.db.set('SMA', this.makeDiodePackage('SMA', 4.6, 2.6, 1.5, 2.0));
    this.db.set('SMB', this.makeDiodePackage('SMB', 5.3, 3.6, 2.0, 2.8));
    this.db.set('SMC', this.makeDiodePackage('SMC', 7.6, 5.1, 2.5, 3.8));
  }

  static getFootprint(packageType: string): Footprint | null {
    this.init();
    return this.db.get(packageType) ?? null;
  }

  static getAllPackageTypes(): string[] {
    this.init();
    return Array.from(this.db.keys()).sort();
  }

  static generateFromConnectors(connectors: ConnectorInput[]): Footprint {
    // Generate a footprint from arbitrary connector/pad specs
    // Used when a component has custom pad definitions
    const pads: Pad[] = connectors.map((c, i) => ({
      number: c.name || String(i + 1),
      type: c.padSpec?.type ?? 'smd',
      shape: (c.padSpec?.shape as PadShape) ?? 'rect',
      position: { x: c.position.x, y: c.position.y },
      width: c.padSpec?.width ?? c.padSpec?.diameter ?? 1.0,
      height: c.padSpec?.height ?? c.padSpec?.diameter ?? 1.0,
      drill: c.padSpec?.drill,
      layer: c.padSpec?.type === 'tht' ? 'both' : 'front',
    }));

    const bb = this.computeBoundingBox(pads);
    return {
      packageType: 'custom',
      description: `Custom ${connectors.length}-pad footprint`,
      pads,
      courtyard: { x: bb.x - 0.25, y: bb.y - 0.25, width: bb.width + 0.5, height: bb.height + 0.5 },
      boundingBox: bb,
      silkscreen: [{ type: 'rect', params: { x: bb.x, y: bb.y, width: bb.width, height: bb.height }, lineWidth: 0.15 }],
      mountingType: pads.some(p => p.type === 'tht') ? 'tht' : 'smd',
      pinCount: pads.length,
    };
  }

  // ... private helper methods: makeDIP, makeSOIC, makeSOT23, etc.
  // Each generates correct pad positions based on IPC-7351 land patterns
  // Full implementations provided in code (not abbreviated)

  private static computeBoundingBox(pads: Pad[]): { x: number; y: number; width: number; height: number } {
    if (pads.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pad of pads) {
      const hw = pad.width / 2;
      const hh = pad.height / 2;
      minX = Math.min(minX, pad.position.x - hw);
      minY = Math.min(minY, pad.position.y - hh);
      maxX = Math.max(maxX, pad.position.x + hw);
      maxY = Math.max(maxY, pad.position.y + hh);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/__tests__/footprint-library.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/lib/pcb/footprint-library.ts client/src/lib/__tests__/footprint-library.test.ts
git commit -m "feat(pcb): add footprint library with 25 built-in packages (FG-01 Phase 1)"
```

---

### Task 2: SVG Pad Renderer Component

**Files:**
- Create: `client/src/components/views/pcb-layout/PadRenderer.tsx`
- Modify: `client/src/components/views/pcb-layout/PCBBoardRenderer.tsx`
- Test: `client/src/components/views/pcb-layout/__tests__/PadRenderer.test.tsx`

**Context:** Replace the 8x12 placeholder rectangles with real SVG pads. Each pad type renders differently:
- SMD rect: `<rect>` with optional corner radius
- SMD circle: `<circle>`
- THT circle: `<circle>` with drill hole (inner circle in different color)
- THT oblong: `<rect rx>` with drill hole
- Solder mask shown as slightly larger outline

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PadRenderer } from '../PadRenderer';
import type { Pad, Footprint } from '@/lib/pcb/footprint-library';

const makePad = (overrides: Partial<Pad> = {}): Pad => ({
  number: '1',
  type: 'smd',
  shape: 'rect',
  position: { x: 0, y: 0 },
  width: 1.2,
  height: 0.6,
  layer: 'front',
  ...overrides,
});

describe('PadRenderer', () => {
  it('renders SMD rect pad as SVG rect', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad()}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>
    );
    const rect = container.querySelector('rect[data-testid="pad-1"]');
    expect(rect).not.toBeNull();
  });

  it('renders THT pad with drill hole', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ type: 'tht', shape: 'circle', width: 1.6, height: 1.6, drill: 0.8 })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(2); // outer pad + drill hole
  });

  it('dims pad when on inactive layer', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ layer: 'back' })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>
    );
    const group = container.querySelector('g[data-testid="pad-group-1"]');
    expect(group?.getAttribute('opacity')).toBe('0.3');
  });

  it('highlights pad when selected', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad()}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={true}
          activeLayer="front"
        />
      </svg>
    );
    const highlight = container.querySelector('[data-testid="pad-highlight-1"]');
    expect(highlight).not.toBeNull();
  });

  it('applies rotation transform', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ position: { x: 1, y: 0 } })}
          componentX={10}
          componentY={10}
          rotation={90}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>
    );
    const group = container.querySelector('g[data-testid="pad-group-1"]');
    expect(group?.getAttribute('transform')).toContain('rotate');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/components/views/pcb-layout/__tests__/PadRenderer.test.tsx`
Expected: FAIL

**Step 3: Write PadRenderer component**

PadRenderer is a pure SVG component that renders a single pad based on its type/shape. It handles:
- SMD pads: colored by layer (red = front, blue = back)
- THT pads: copper annular ring + drill hole (dark center)
- Solder mask expansion outline
- Selection highlighting (neon cyan glow)
- Layer dimming (opacity 0.3 when pad's layer doesn't match active layer)
- Rotation around component center
- Net name tooltip on hover

**Step 4: Modify PCBBoardRenderer.tsx**

Replace the placeholder `<rect width={8} height={12}>` component rendering with:
1. Look up footprint via `FootprintLibrary.getFootprint(instance.packageType)`
2. If found, render each pad via `<PadRenderer>`
3. If not found, fall back to generating from connector data via `FootprintLibrary.generateFromConnectors()`
4. Render silkscreen elements (outline, pin-1 marker, reference designator)
5. Render courtyard as dashed outline when DRC overlay is active

**Step 5: Run tests, commit**

Run: `npx vitest run client/src/components/views/pcb-layout/`
Expected: PASS

```bash
git add client/src/components/views/pcb-layout/PadRenderer.tsx \
  client/src/components/views/pcb-layout/__tests__/PadRenderer.test.tsx \
  client/src/components/views/pcb-layout/PCBBoardRenderer.tsx
git commit -m "feat(pcb): real pad rendering with layer-aware SVG geometry (FG-01)"
```

---

### Task 3: Footprint Placement + Rotation Snapping

**Files:**
- Modify: `client/src/components/views/pcb-layout/PCBInteractionManager.ts`
- Modify: `client/src/components/views/pcb-layout/ComponentPlacer.ts`
- Test: `client/src/lib/__tests__/footprint-placement.test.ts`

**Context:** Component placement needs to work with real footprints. Add rotation snapping (0/90/180/270), footprint-aware courtyard collision detection, and pin-1 alignment indicators.

**Key changes:**
- `PCBInteractionManager`: Add 'R' key handler to rotate selected component by 90 degrees. Snap rotation to 0/90/180/270 on placement.
- `ComponentPlacer`: Replace simple rectangle collision with courtyard-based collision detection using the actual footprint bounding box. Update ratsnest calculation to use real pad positions instead of component center.

---

### Task 4: Net-to-Pad Assignment

**Files:**
- Create: `client/src/lib/pcb/net-pad-mapper.ts`
- Test: `client/src/lib/__tests__/net-pad-mapper.test.ts`

**Context:** Map circuit nets to physical pads. When a net connects pin 3 of U1 to pin 1 of R1, we need to resolve that to specific pad coordinates on the placed footprints. This drives ratsnest lines and trace routing.

**Key functionality:**
- `NetPadMapper.resolve(nets, instances, footprints)` — returns `Map<netId, Pad[]>`
- Handles pin name → pad number mapping
- Handles hierarchical nets (bus expansion)
- Generates ratsnest pairs (shortest unrouted connections)

---

## Phase 2: Via Entity Model + Layer Transitions

### Task 5: Via Types + Schema Extension

**Files:**
- Create: `client/src/lib/pcb/via-model.ts`
- Test: `client/src/lib/__tests__/via-model.test.ts`

**Context:** Currently vias don't exist as a distinct entity — they're just wires. We need a proper via model with drill diameter, annular ring, start/end layers, and blind/buried/through types.

**Types:**
```typescript
export type ViaType = 'through' | 'blind' | 'buried' | 'micro';

export interface Via {
  id: string;
  position: { x: number; y: number }; // mm
  drillDiameter: number; // mm
  outerDiameter: number; // mm (drill + 2 * annular ring)
  type: ViaType;
  fromLayer: string;
  toLayer: string;
  netId?: string;
  tented: boolean; // solder mask covers via
}

export interface ViaRules {
  minDrill: number; // mm
  minAnnularRing: number; // mm
  minDrillToTraceClr: number; // mm
  minDrillToDrillClr: number; // mm
  allowBlind: boolean;
  allowBuried: boolean;
  allowMicro: boolean;
}
```

**Functionality:**
- `ViaModel.create(position, netId, type?)` — creates via with default sizing from DFM rules
- `ViaModel.validate(via, rules)` — checks against DFM constraints
- `ViaModel.calculateAnnularRing(via)` — returns actual annular ring width
- Default via: through, 0.3mm drill, 0.6mm outer, tented=true

---

### Task 6: Via Renderer + Placement Tool

**Files:**
- Create: `client/src/components/views/pcb-layout/ViaRenderer.tsx`
- Modify: `client/src/components/views/pcb-layout/PCBInteractionManager.ts`
- Modify: `client/src/components/views/pcb-layout/LayerManager.ts`
- Test: `client/src/components/views/pcb-layout/__tests__/ViaRenderer.test.tsx`

**Context:** Render vias as concentric circles (outer ring = copper, inner = drill hole). Add 'V' key to switch to via placement tool. Vias snap to grid. When placing a via during trace routing, it transitions the trace to the opposite layer.

---

### Task 7: Layer Stack Visualization Panel

**Files:**
- Create: `client/src/components/views/pcb-layout/LayerStackPanel.tsx`
- Test: `client/src/components/views/pcb-layout/__tests__/LayerStackPanel.test.tsx`

**Context:** Small collapsible panel showing the current layer stack from board-stackup.ts. Click a layer to set it active. Shows copper weight, thickness, material. Integrates with existing `useBoardStackup()` hook.

---

## Phase 3: Interactive Trace Routing with DRC

### Task 8: PCB Trace Router — Point-to-Point with DRC

**Files:**
- Create: `client/src/lib/pcb/trace-router.ts`
- Test: `client/src/lib/__tests__/trace-router.test.ts`

**Context:** Interactive trace routing engine. When the user clicks a pad, the router starts a trace. As the mouse moves, the trace follows with 45-degree angle snapping (horizontal, vertical, 45-degree diagonal). DRC violations show in real-time (red highlight when trace violates clearance). Click to place a vertex, double-click or click the target pad to finish.

**Key algorithms:**
- **45-degree constraint:** From current point, project mouse position onto the nearest 45-degree angle axis (0, 45, 90, 135, 180, 225, 270, 315 degrees). Use the axis closest to the mouse angle.
- **Trace width from net class:** Look up net class rules for the active net. Default 0.254mm (10 mil).
- **Real-time DRC:** On each mouse move, check trace-to-pad clearance, trace-to-trace clearance, trace-to-edge clearance using spatial grid from drc-engine.ts.
- **Layer-aware:** Trace stays on active layer. Press 'V' mid-route to drop a via and switch layers.

**API:**
```typescript
export class PCBTraceRouter {
  constructor(drcRules: DRCRule[], obstacles: Obstacle[]);

  startTrace(fromPad: Pad, layer: string, width: number): void;
  updatePreview(mousePos: { x: number; y: number }): TracePreview;
  addVertex(): void;
  insertVia(): Via; // drops via at current position, switches layer
  finishTrace(toPad?: Pad): TraceResult;
  cancelTrace(): void;

  getViolations(): DRCViolation[];
}

export interface TracePreview {
  points: Array<{ x: number; y: number }>;
  layer: string;
  width: number;
  violations: DRCViolation[];
  valid: boolean;
}

export interface TraceResult {
  wires: Array<{ points: Array<{ x: number; y: number }>; layer: string; width: number }>;
  vias: Via[];
  netId: string;
}
```

---

### Task 9: Trace Editing — Move/Delete Segments

**Files:**
- Modify: `client/src/lib/pcb/trace-router.ts`
- Modify: `client/src/components/views/pcb-layout/PCBInteractionManager.ts`
- Test: `client/src/lib/__tests__/trace-editing.test.ts`

**Context:** After traces are placed, the user needs to edit them:
- Click a trace segment to select it (highlight in neon cyan)
- Drag a segment to move it (maintains 45-degree angles on adjacent segments)
- Press Delete to remove a segment (breaks net — shows ratsnest for unrouted portion)
- Click a vertex to drag it (both adjacent segments adjust)
- Double-click a trace to select the entire net's routing

---

### Task 10: Trace Width Control + Net Class Rules

**Files:**
- Create: `client/src/lib/pcb/net-class-rules.ts`
- Test: `client/src/lib/__tests__/net-class-rules.test.ts`

**Context:** Different nets need different trace widths. Power nets need wider traces (0.5mm+), signal nets use standard (0.254mm), high-speed nets need controlled impedance (calculated from board stackup). Net class rules define per-net or per-class trace width, clearance, and via size.

**Types:**
```typescript
export interface NetClass {
  name: string;
  traceWidth: number; // mm
  clearance: number; // mm
  viaDrill: number; // mm
  viaOuter: number; // mm
  diffPairWidth?: number; // mm
  diffPairGap?: number; // mm
}

export const DEFAULT_NET_CLASSES: Record<string, NetClass> = {
  'Default': { name: 'Default', traceWidth: 0.254, clearance: 0.2, viaDrill: 0.3, viaOuter: 0.6 },
  'Power': { name: 'Power', traceWidth: 0.5, clearance: 0.3, viaDrill: 0.4, viaOuter: 0.8 },
  'High-Speed': { name: 'High-Speed', traceWidth: 0.15, clearance: 0.15, viaDrill: 0.2, viaOuter: 0.45 },
};
```

---

### Task 11: Real-Time DRC During Routing

**Files:**
- Create: `client/src/lib/pcb/pcb-drc-checker.ts`
- Test: `client/src/lib/__tests__/pcb-drc-checker.test.ts`

**Context:** Extend the shared DRC engine with PCB-specific spatial queries. Build an obstacle database from placed footprints, routed traces, vias, copper pours, and board edges. Provide millisecond-level query performance for real-time feedback during routing.

**Key functions:**
- `PCBDrcChecker.buildObstacleDB(instances, traces, vias, pours, boardOutline)` — spatial index
- `PCBDrcChecker.checkTrace(tracePoints, width, layer, netId)` — returns violations for a proposed trace
- `PCBDrcChecker.checkVia(position, drillDiam, outerDiam, netId)` — check via placement
- `PCBDrcChecker.checkAll()` — full board DRC (used for export gate)

---

## Phase 4: Maze Router (A* with DRC Avoidance)

### Task 12: Grid-Based Maze Router

**Files:**
- Create: `client/src/lib/pcb/maze-router.ts`
- Test: `client/src/lib/__tests__/maze-router.test.ts`

**Context:** Replace the stub autorouter with a real A* maze router. Discretize the board into a routing grid (default 0.1mm resolution). Mark obstacles (pads, traces, vias, pours, edges) as blocked cells. Route each net using A* with Manhattan distance heuristic, respecting clearance rules.

**Algorithm:**
1. Build occupancy grid from placed components, existing traces, vias, board edges
2. For each unrouted net (sorted by shortest ratsnest first):
   a. Find source pad grid position
   b. Find target pad grid position
   c. A* search with 8-directional movement (orthogonal + 45-degree)
   d. Apply clearance buffer around obstacles (inflate blocked cells by clearance/gridSize)
   e. Penalize layer changes (via cost = 10x step cost)
   f. Convert grid path to trace points (simplify colinear segments)
   g. Add path to obstacle grid for subsequent nets
3. Return routed traces + any unroutable nets

**Performance target:** Route 50 nets on a 100x100mm board in <5 seconds

---

### Task 13: Multi-Net Ordering + Rip-Up Retry

**Files:**
- Modify: `client/src/lib/pcb/maze-router.ts`
- Test: `client/src/lib/__tests__/maze-router-rip-up.test.ts`

**Context:** Net ordering affects routability. Add:
- Sort nets by criticality (power first, then shortest, then longest)
- After initial pass, attempt rip-up and reroute for failed nets:
  1. For each failed net, remove the blocking net's trace
  2. Route the failed net
  3. Reroute the ripped-up net via alternative path
  4. Max 3 rip-up iterations per net

---

### Task 14: Autoroute Server Endpoint Upgrade

**Files:**
- Modify: `server/circuit-routes/autoroute.ts`
- Test: `server/__tests__/autoroute.test.ts`

**Context:** The current autoroute endpoint returns straight-line connections. Upgrade it to:
1. Fetch all instances, nets, wires for the circuit
2. Build footprint placements from instance positions
3. Call MazeRouter with the board geometry
4. Save resulting wires via storage
5. Return routed wire IDs + statistics (routed/unrouted/vias)

Note: The actual maze router runs client-side for interactive use, but the server endpoint provides a batch autoroute capability for AI tools and batch operations.

---

## Phase 5: Integration (Export, Copper Pour, 3D)

### Task 15: Gerber Export Integration

**Files:**
- Modify: `server/export/gerber-generator.ts`
- Test: `server/__tests__/gerber-integration.test.ts`

**Context:** Connect Gerber export to real PCB layout data (FG-07). Currently generates from schematic topology. Needs to:
- Read actual trace geometries from circuitWires (layer, points, width)
- Read via drill positions from wire data or via entities
- Read copper pour polygons
- Generate proper layer files: F.Cu, B.Cu, F.Mask, B.Mask, F.Silk, B.Silk, Edge.Cuts
- Generate proper drill file from via + THT pad positions

---

### Task 16: Copper Pour Integration with Routing

**Files:**
- Modify: `client/src/lib/copper-pour.ts` (add trace/via obstacle ingestion)
- Create: `client/src/lib/pcb/copper-pour-bridge.ts`
- Test: `client/src/lib/__tests__/copper-pour-bridge.test.ts`

**Context:** Copper pour currently doesn't know about routed traces or vias. Bridge the copper pour engine with the routing data:
- Extract trace geometries as rectangular obstacles
- Extract via positions as circular obstacles
- Extract pad positions as obstacles (with thermal relief for net-connected pads)
- Regenerate pour fill when routing changes

---

### Task 17: 3D Viewer Integration

**Files:**
- Modify: `client/src/components/views/BoardViewer3DView.tsx`
- Test: `client/src/components/views/__tests__/BoardViewer3DView.test.tsx`

**Context:** The 3D viewer uses placeholder boxes. Integrate real footprint data:
- Component heights from package database
- Real body dimensions (width/height from footprint boundingBox, depth from package DB)
- Trace visualization as thin copper strips on board surface
- Via visualization as cylinders through board

---

## Execution Strategy: `/agent-teams`

**Use `/agent-teams` for each phase.** Each phase runs as a coordinated team with strict file ownership.

### Phase 1 Team: Footprints (Wave 42)

```
/agent-teams

Create a team of 4 teammates to implement PCB footprint rendering:

Teammate 1 "footprint-lib":
- Files: client/src/lib/pcb/footprint-library.ts, client/src/lib/__tests__/footprint-library.test.ts
- Task: Build FootprintLibrary class with 25 built-in package footprints (DIP, SOIC, SOT, QFP, TO, chip components)
- See Task 1 in docs/plans/2026-03-05-pcb-layout-engine.md for full spec

Teammate 2 "pad-renderer":
- Files: client/src/components/views/pcb-layout/PadRenderer.tsx, client/src/components/views/pcb-layout/__tests__/PadRenderer.test.tsx
- Task: SVG pad renderer component (SMD rect/circle, THT with drill hole, layer dimming, selection highlight)
- BLOCKED BY footprint-lib (needs Pad type) — wait for teammate 1 to finish types
- See Task 2 in docs/plans/2026-03-05-pcb-layout-engine.md

Teammate 3 "placement":
- Files: client/src/components/views/pcb-layout/PCBInteractionManager.ts, client/src/components/views/pcb-layout/ComponentPlacer.ts, client/src/lib/__tests__/footprint-placement.test.ts
- Task: Rotation snapping (R key = 90deg), courtyard collision detection, real pad position ratsnest
- BLOCKED BY footprint-lib — wait for teammate 1
- See Task 3 in docs/plans/2026-03-05-pcb-layout-engine.md

Teammate 4 "net-mapper":
- Files: client/src/lib/pcb/net-pad-mapper.ts, client/src/lib/__tests__/net-pad-mapper.test.ts
- Task: Map circuit nets to physical pad coordinates for ratsnest and routing
- BLOCKED BY footprint-lib — wait for teammate 1
- See Task 4 in docs/plans/2026-03-05-pcb-layout-engine.md

Integration (lead): Wire PadRenderer into PCBBoardRenderer.tsx after all teammates complete.

Require plan approval before implementation.
```

### Phase 2 Team: Vias + Layers (Wave 43)

```
/agent-teams

Create a team of 3 teammates:

Teammate 1 "via-model":
- Files: client/src/lib/pcb/via-model.ts, client/src/lib/__tests__/via-model.test.ts
- Task: Via types (through/blind/buried/micro), validation, annular ring calc, default sizing
- See Task 5 in docs/plans/2026-03-05-pcb-layout-engine.md

Teammate 2 "via-renderer":
- Files: client/src/components/views/pcb-layout/ViaRenderer.tsx, client/src/components/views/pcb-layout/__tests__/ViaRenderer.test.tsx
- Task: SVG via rendering (concentric circles), 'V' key placement tool
- Also modify: LayerManager.ts (add via tool to PcbTool union)
- BLOCKED BY via-model — wait for teammate 1

Teammate 3 "layer-panel":
- Files: client/src/components/views/pcb-layout/LayerStackPanel.tsx, client/src/components/views/pcb-layout/__tests__/LayerStackPanel.test.tsx
- Task: Collapsible layer stack panel showing board-stackup layers, click to set active
- INDEPENDENT — can start immediately
- See Task 7 in docs/plans/2026-03-05-pcb-layout-engine.md
```

### Phase 3 Team: Interactive Routing (Waves 44-45)

```
/agent-teams

Create a team of 4 teammates:

Teammate 1 "trace-router":
- Files: client/src/lib/pcb/trace-router.ts, client/src/lib/__tests__/trace-router.test.ts
- Task: Interactive trace routing — 45deg snapping, via insertion mid-route, real-time DRC preview
- See Task 8 in docs/plans/2026-03-05-pcb-layout-engine.md

Teammate 2 "trace-edit":
- Files: client/src/lib/__tests__/trace-editing.test.ts
- Also modify: client/src/lib/pcb/trace-router.ts (add editing methods — coordinate with teammate 1)
- Task: Trace segment selection, drag-move, delete, vertex dragging
- BLOCKED BY trace-router — wait for teammate 1's core API
- See Task 9

Teammate 3 "net-classes":
- Files: client/src/lib/pcb/net-class-rules.ts, client/src/lib/__tests__/net-class-rules.test.ts
- Task: Net class definitions (Default/Power/High-Speed), per-net trace width/clearance/via rules
- INDEPENDENT — can start immediately
- See Task 10

Teammate 4 "pcb-drc":
- Files: client/src/lib/pcb/pcb-drc-checker.ts, client/src/lib/__tests__/pcb-drc-checker.test.ts
- Task: PCB-specific DRC spatial index, trace/via/pad clearance checking, millisecond performance
- INDEPENDENT — can start immediately
- See Task 11
```

### Phase 4 Team: Autorouter (Wave 46)

```
/agent-teams

Create a team of 3 teammates:

Teammate 1 "maze-router":
- Files: client/src/lib/pcb/maze-router.ts, client/src/lib/__tests__/maze-router.test.ts
- Task: A* maze router on discretized grid, 8-directional, clearance inflation, layer-change cost
- See Task 12

Teammate 2 "rip-up":
- Files: client/src/lib/__tests__/maze-router-rip-up.test.ts
- Also modify: client/src/lib/pcb/maze-router.ts (extend with rip-up logic — coordinate with teammate 1)
- Task: Net ordering by criticality, rip-up and reroute for failed nets, max 3 iterations
- BLOCKED BY maze-router
- See Task 13

Teammate 3 "server-autoroute":
- Files: server/circuit-routes/autoroute.ts, server/__tests__/autoroute.test.ts
- Task: Upgrade server autoroute endpoint to use real routing data, save results
- INDEPENDENT — can start immediately (server-side, uses storage)
- See Task 14
```

### Phase 5 Team: Integration (Wave 47)

```
/agent-teams

Create a team of 3 teammates:

Teammate 1 "gerber-integration":
- Files: server/export/gerber-generator.ts, server/__tests__/gerber-integration.test.ts
- Task: Connect Gerber export to real trace/via/pour data from circuit schema
- See Task 15

Teammate 2 "pour-bridge":
- Files: client/src/lib/pcb/copper-pour-bridge.ts, client/src/lib/__tests__/copper-pour-bridge.test.ts
- Also modify: client/src/lib/copper-pour.ts (add trace/via obstacle ingestion)
- Task: Bridge copper pour engine with routing data
- See Task 16

Teammate 3 "3d-viewer":
- Files: client/src/components/views/BoardViewer3DView.tsx, client/src/components/views/__tests__/BoardViewer3DView.test.tsx
- Task: Real footprint dimensions, trace strips, via cylinders in 3D view
- See Task 17
```

### MANDATORY: Research Before Implementation

**Before ANY code is written in any phase, the lead MUST perform research using Context7 and/or WebSearch.** This is not optional. Stale training data causes bugs. Research first, implement second.

#### Research Checklist (run before each phase)

1. **Context7 — Library docs** (for every library used in that phase):
   ```
   # Always resolve-library-id FIRST, then query-docs
   Context7: resolve-library-id "react" → query-docs "SVG rendering patterns in React 19"
   Context7: resolve-library-id "vitest" → query-docs "testing SVG components with happy-dom"
   Context7: resolve-library-id "drizzle-orm" → query-docs "jsonb column queries"
   ```

2. **WebSearch — Domain knowledge** (PCB/EDA-specific):
   ```
   # Phase 1: Footprints
   WebSearch: "IPC-7351 land pattern standard pad dimensions"
   WebSearch: "KiCad footprint library format pad geometry"
   WebSearch: "SMD pad dimensions DIP-8 SOIC-8 SOT-23 QFP datasheet"

   # Phase 2: Vias
   WebSearch: "PCB via types blind buried micro via IPC standards"
   WebSearch: "via annular ring calculation minimum drill size"

   # Phase 3: Routing
   WebSearch: "interactive PCB trace routing algorithm 45 degree constraint"
   WebSearch: "PCB DRC clearance checking spatial index algorithm"
   WebSearch: "net class trace width power ground signal high-speed"

   # Phase 4: Autorouter
   WebSearch: "PCB maze router A* algorithm implementation"
   WebSearch: "Lee algorithm PCB routing grid rip-up reroute"
   WebSearch: "FreeRouting open source PCB autorouter algorithm"

   # Phase 5: Integration
   WebSearch: "Gerber RS-274X format trace aperture specification"
   WebSearch: "Excellon drill file format via holes"
   ```

3. **Context7 — Verify API usage** before using any library method:
   ```
   # If using ws (WebSocket) — verify current API
   Context7: resolve-library-id "ws" → query-docs "WebSocketServer attach to existing http server"

   # If using happy-dom for SVG tests
   Context7: resolve-library-id "@testing-library/react" → query-docs "testing SVG elements render"
   ```

**Each teammate's spawn prompt MUST include:** "Before writing any code, use Context7 to verify the current API for every library you import, and use WebSearch to research the domain-specific standards (IPC, Gerber, etc.) relevant to your task."

#### Why This Matters

- React 19 changed SVG handling — verify before assuming
- Vitest 4 changed mock typing — verify vi.fn() patterns
- IPC pad standards have specific tolerances — don't guess dimensions
- Gerber format has strict aperture requirements — don't approximate
- Training data may show deprecated APIs — always verify

### Team Execution Checklist (per phase)

1. **Research phase** — Lead uses Context7 + WebSearch for domain + library knowledge
2. Run `/agent-teams` with the prompt above (include research findings in spawn prompts)
3. Lead reviews teammate plans before approving
4. Teammates implement with strict file ownership
5. After all teammates complete:
   - Lead runs `npm run check` — must be zero errors
   - Lead runs `npm test` — must pass
   - Lead commits: `git commit -m "feat(pcb): Phase N description (FG-01)"`
6. Clean up team before starting next phase

**Total: 5 teams across Waves 42-47 (~6 waves including routing which may span 2)**

## Dependencies

```
Task 1 (footprint lib)
  ├── Task 2 (pad renderer)
  │     └── Task 3 (placement)
  ├── Task 4 (net-pad mapper)
  │     └── Task 8 (trace router)
  │           ├── Task 9 (trace editing)
  │           ├── Task 11 (real-time DRC)
  │           └── Task 12 (maze router)
  │                 ├── Task 13 (rip-up)
  │                 └── Task 14 (server autoroute)
  ├── Task 5 (via model)
  │     └── Task 6 (via renderer)
  └── Task 10 (net classes) ── standalone

Task 7 (layer stack panel) ── standalone (uses existing board-stackup)
Task 15 (Gerber) ── after Tasks 8+5 (needs trace + via data)
Task 16 (copper pour bridge) ── after Task 8 (needs trace data)
Task 17 (3D viewer) ── after Tasks 1+5 (needs footprint + via data)
```

## Downstream Unblocks

Once FG-01 is complete, these items become immediately actionable:

| Item | Description | New Prerequisite Status |
|------|-------------|------------------------|
| FG-04 | PCB autorouter | Phase 4 IS the autorouter |
| FG-07 | Gerber → real PCB data | Phase 5 Task 15 |
| FG-10 | One-click PCB ordering | Gerber + DFM outputs exist |
| FG-11 | Push-and-shove routing | Extend Phase 3 trace router |
| FG-16 | Differential pair routing | Extend net classes + trace router |
| FG-17 | Multi-layer PCB (32+) | Via model supports N layers |
| FG-18 | ECAD-MCAD / STEP | 3D viewer provides geometry |
| FG-20 | Signal integrity | Trace geometry + stackup available |
| EN-04 | PCB auto-router engine | = FG-04 |
| EN-06 | Manual PCB trace routing | Phase 3 IS manual routing |
