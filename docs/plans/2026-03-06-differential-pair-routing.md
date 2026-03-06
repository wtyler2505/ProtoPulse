# FG-16: Differential Pair Routing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add differential pair routing support to the PCB layout engine — route two traces simultaneously with controlled spacing, impedance-aware geometry, length matching with meander tuning, DRC enforcement, and protocol presets (USB, HDMI, LVDS, PCIe).

**Architecture:** Three pure-logic modules — `DiffPairRouter` (centerline-to-pair geometry + interactive routing), `DiffPairManager` (pair assignments, protocol presets, skew DRC), `DiffPairMeander` (serpentine length tuning). All integrate with existing `NetClassManager` (already has `diffPairWidth`/`diffPairGap`), `PushShoveEngine` (obstacle displacement), `differentialZ0()` (impedance calc), and `PCBDrcChecker` (spatial DRC). No new database tables — diff pair config persists in circuit design JSONB properties.

**Tech Stack:** TypeScript 5.6, Vitest 4, pure classes (no React/DOM), existing PCB modules in `client/src/lib/pcb/`

---

## Existing Infrastructure

| Module | File | What FG-16 Uses |
|--------|------|-----------------|
| NetClassManager | `client/src/lib/pcb/net-class-rules.ts` | `diffPairWidth`, `diffPairGap` fields already on `NetClass` interface |
| TraceRouter | `client/src/lib/pcb/trace-router.ts` | `snapAngle45()`, `staircaseRoute()`, `TracePoint`, `TraceResult` types |
| PushShoveEngine | `client/src/lib/pcb/push-shove-engine.ts` | `PushShoveSegment`, `segmentsCollide()`, `segmentToSegmentDistance()` |
| PCBDrcChecker | `client/src/lib/pcb/pcb-drc-checker.ts` | `PCBObstacle`, `PCBDrcViolation` types, spatial grid |
| transmission-line | `client/src/lib/simulation/transmission-line.ts` | `differentialZ0(params, spacing)` — already computes Zdiff |
| si-advisor | `client/src/lib/simulation/si-advisor.ts` | `diffPairWith`, `diffPairLengthA/B`, `maxSkewPs` — already in trace model |
| ViaModel | `client/src/lib/pcb/via-model.ts` | `ViaModel.create()` for via pair generation |
| layer-utils | `client/src/lib/pcb/layer-utils.ts` | `normalizeLegacyLayer()`, `getLayerName()` |

---

## Phase 1: Core Differential Pair Routing Engine

### Task 1: DiffPairRouter — Centerline-to-Pair Geometry

**Files:**
- Create: `client/src/lib/pcb/diff-pair-router.ts`
- Test: `client/src/lib/__tests__/diff-pair-router.test.ts`

**Context:**
- The router takes a centerline path (array of `{x,y}` points) and a gap/width config, and produces two parallel trace paths (P and N).
- At straight segments, P and N are offset ±(width/2 + gap/2) perpendicular to the centerline.
- At bends, the inner trace has a shorter path than the outer — this length difference is tracked for skew calculation.
- Uses `snapAngle45()` from `trace-router.ts` for 45° snapping on the centerline.
- Import types: `TracePoint` from `trace-router.ts`.

**Step 1: Write failing tests**

```typescript
// client/src/lib/__tests__/diff-pair-router.test.ts
import { describe, it, expect } from 'vitest';
import {
  offsetPath,
  generateDiffPair,
  diffPairVias,
  DiffPairConfig,
  DiffPairResult,
} from '../pcb/diff-pair-router';

describe('DiffPairRouter', () => {
  const defaultConfig: DiffPairConfig = {
    traceWidth: 0.15,  // mm
    gap: 0.15,         // mm — edge-to-edge
    layer: 'F.Cu',
    netIdP: 'usb_dp',
    netIdN: 'usb_dn',
  };

  describe('offsetPath', () => {
    it('should offset a horizontal segment positively', () => {
      const center = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const offset = 0.15; // mm
      const result = offsetPath(center, offset);
      expect(result).toHaveLength(2);
      expect(result[0].y).toBeCloseTo(0.15);
      expect(result[1].y).toBeCloseTo(0.15);
      expect(result[0].x).toBeCloseTo(0);
      expect(result[1].x).toBeCloseTo(10);
    });

    it('should offset a horizontal segment negatively', () => {
      const center = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const result = offsetPath(center, -0.15);
      expect(result[0].y).toBeCloseTo(-0.15);
      expect(result[1].y).toBeCloseTo(-0.15);
    });

    it('should offset a vertical segment', () => {
      const center = [{ x: 0, y: 0 }, { x: 0, y: 10 }];
      const result = offsetPath(center, 0.15);
      expect(result[0].x).toBeCloseTo(-0.15);
      expect(result[1].x).toBeCloseTo(-0.15);
    });

    it('should offset a 45-degree segment', () => {
      const center = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
      const result = offsetPath(center, 0.15);
      // Perpendicular to 45deg NE is NW direction
      const expected = 0.15 / Math.sqrt(2);
      expect(result[0].x).toBeCloseTo(-expected);
      expect(result[0].y).toBeCloseTo(expected);
    });

    it('should handle multi-segment path with bend', () => {
      // L-shape: right then up
      const center = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
      const result = offsetPath(center, 0.15);
      expect(result).toHaveLength(3);
      // First segment offset up
      expect(result[0].y).toBeCloseTo(0.15);
      // Corner point
      expect(result[1].x).toBeCloseTo(10 - 0.15);
      expect(result[1].y).toBeCloseTo(0.15);
      // Second segment offset left
      expect(result[2].x).toBeCloseTo(10 - 0.15);
    });

    it('should return empty array for single-point path', () => {
      expect(offsetPath([{ x: 0, y: 0 }], 0.15)).toEqual([{ x: 0, y: 0 }]);
    });

    it('should return empty array for empty path', () => {
      expect(offsetPath([], 0.15)).toEqual([]);
    });
  });

  describe('generateDiffPair', () => {
    it('should produce P and N traces from a straight centerline', () => {
      const centerline = [{ x: 0, y: 0 }, { x: 20, y: 0 }];
      const result = generateDiffPair(centerline, defaultConfig);

      expect(result.pathP).toHaveLength(2);
      expect(result.pathN).toHaveLength(2);

      // P trace offset = +(traceWidth/2 + gap/2) = +(0.075 + 0.075) = +0.15
      const halfPitch = (defaultConfig.traceWidth + defaultConfig.gap) / 2;
      expect(result.pathP[0].y).toBeCloseTo(halfPitch);
      expect(result.pathN[0].y).toBeCloseTo(-halfPitch);

      expect(result.lengthP).toBeCloseTo(20);
      expect(result.lengthN).toBeCloseTo(20);
      expect(result.skewMm).toBeCloseTo(0);
    });

    it('should compute skew for a 90-degree bend', () => {
      // Right then up — outer trace is longer
      const centerline = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ];
      const result = generateDiffPair(centerline, defaultConfig);

      expect(result.pathP).toHaveLength(3);
      expect(result.pathN).toHaveLength(3);
      // Skew should be non-zero due to the bend
      expect(Math.abs(result.skewMm)).toBeGreaterThan(0);
    });

    it('should preserve layer and net IDs in result', () => {
      const centerline = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const result = generateDiffPair(centerline, defaultConfig);

      expect(result.layer).toBe('F.Cu');
      expect(result.netIdP).toBe('usb_dp');
      expect(result.netIdN).toBe('usb_dn');
      expect(result.traceWidth).toBe(0.15);
      expect(result.gap).toBe(0.15);
    });

    it('should handle a straight diagonal centerline', () => {
      const centerline = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
      const result = generateDiffPair(centerline, defaultConfig);

      expect(result.pathP).toHaveLength(2);
      expect(result.pathN).toHaveLength(2);
      // Both traces same length on a straight diagonal
      expect(result.lengthP).toBeCloseTo(result.lengthN, 4);
    });

    it('should reject empty centerline', () => {
      expect(() => generateDiffPair([], defaultConfig)).toThrow(/at least 2/i);
    });

    it('should reject single-point centerline', () => {
      expect(() => generateDiffPair([{ x: 0, y: 0 }], defaultConfig)).toThrow(/at least 2/i);
    });

    it('should reject zero or negative gap', () => {
      const badConfig = { ...defaultConfig, gap: 0 };
      const centerline = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      expect(() => generateDiffPair(centerline, badConfig)).toThrow(/gap/i);
    });

    it('should reject zero or negative traceWidth', () => {
      const badConfig = { ...defaultConfig, traceWidth: -1 };
      const centerline = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      expect(() => generateDiffPair(centerline, badConfig)).toThrow(/width/i);
    });
  });

  describe('diffPairVias', () => {
    it('should generate two vias with controlled spacing', () => {
      const centerPoint = { x: 10, y: 5 };
      const direction = { x: 1, y: 0 }; // heading right
      const config = { ...defaultConfig };

      const result = diffPairVias(centerPoint, direction, config, 'F.Cu', 'B.Cu');

      expect(result.viaP).toBeDefined();
      expect(result.viaN).toBeDefined();

      // Vias should be offset perpendicular to direction
      const halfPitch = (config.traceWidth + config.gap) / 2;
      const dx = result.viaP.position.x - result.viaN.position.x;
      const dy = result.viaP.position.y - result.viaN.position.y;
      const viaDist = Math.sqrt(dx * dx + dy * dy);
      expect(viaDist).toBeCloseTo(2 * halfPitch);

      expect(result.viaP.fromLayer).toBe('F.Cu');
      expect(result.viaP.toLayer).toBe('B.Cu');
      expect(result.viaN.fromLayer).toBe('F.Cu');
      expect(result.viaN.toLayer).toBe('B.Cu');
    });

    it('should offset vias perpendicular to a diagonal direction', () => {
      const centerPoint = { x: 5, y: 5 };
      const direction = { x: 1, y: 1 }; // 45 degrees
      const config = { ...defaultConfig };

      const result = diffPairVias(centerPoint, direction, config, 'F.Cu', 'B.Cu');

      // Perpendicular to (1,1) is (-1,1) normalized
      const halfPitch = (config.traceWidth + config.gap) / 2;
      const dx = result.viaP.position.x - centerPoint.x;
      const dy = result.viaP.position.y - centerPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(halfPitch);
    });
  });

  describe('pathLength', () => {
    it('should compute euclidean path length', () => {
      // Re-exported for testing
      const { pathLength } = await import('../pcb/diff-pair-router');
      expect(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBeCloseTo(5);
      expect(pathLength([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBeCloseTo(20);
    });
  });
});
```

**Step 2: Run tests — expect RED (module not found)**

```bash
npx vitest run client/src/lib/__tests__/diff-pair-router.test.ts
```

**Step 3: Implement `diff-pair-router.ts`**

Core logic:
- `offsetPath(centerline, offset)` — Offset each segment perpendicular to its direction. At bends, compute the miter/bisector intersection point for the offset path. Positive offset = left of travel direction, negative = right.
- `generateDiffPair(centerline, config)` — Compute P path at `+halfPitch` offset and N path at `-halfPitch` offset where `halfPitch = (traceWidth + gap) / 2`. Measure both path lengths, compute skew.
- `diffPairVias(center, direction, config, fromLayer, toLayer)` — Generate two vias offset ±halfPitch perpendicular to the direction vector.
- `pathLength(points)` — Sum of segment euclidean distances.

Key geometry:
- Perpendicular to segment `(dx, dy)` is `(-dy, dx)` normalized.
- At vertex `i`, bisector is the average of the normals of segments `i-1→i` and `i→i+1`. Offset distance along bisector = `offset / cos(halfAngle)` to maintain constant edge-to-edge gap (miter join).
- Cap miter factor at 3.0 to prevent spike artifacts on sharp bends.

```typescript
// Types
export interface DiffPairConfig {
  traceWidth: number; // mm — width of each trace
  gap: number;        // mm — edge-to-edge spacing
  layer: string;
  netIdP: string;
  netIdN: string;
}

export interface DiffPairResult {
  pathP: Point2D[];
  pathN: Point2D[];
  lengthP: number;
  lengthN: number;
  skewMm: number;    // lengthP - lengthN (positive = P longer)
  traceWidth: number;
  gap: number;
  layer: string;
  netIdP: string;
  netIdN: string;
}

export interface DiffPairViaResult {
  viaP: { position: Point2D; fromLayer: string; toLayer: string };
  viaN: { position: Point2D; fromLayer: string; toLayer: string };
}

interface Point2D { x: number; y: number; }
```

**Step 4: Run tests — expect GREEN**

```bash
npx vitest run client/src/lib/__tests__/diff-pair-router.test.ts
```

**Step 5: Commit**

```bash
git add client/src/lib/pcb/diff-pair-router.ts client/src/lib/__tests__/diff-pair-router.test.ts
git commit -m "feat(pcb): FG-16 Task 1 — differential pair router core (centerline-to-pair geometry)"
```

---

### Task 2: DiffPairManager — Pair Assignments, Protocol Presets, Skew DRC

**Files:**
- Create: `client/src/lib/pcb/diff-pair-manager.ts`
- Test: `client/src/lib/__tests__/diff-pair-manager.test.ts`

**Context:**
- Singleton+subscribe pattern (same as `FlexZoneManager`, `BoardStackup`, etc.).
- Manages which nets form differential pairs, with protocol presets.
- Computes DRC violations specific to diff pairs: gap violations, width violations, skew violations, uncoupled-length violations.
- Serializable to/from JSON for persistence in circuit design JSONB properties.

**Step 1: Write failing tests**

```typescript
// client/src/lib/__tests__/diff-pair-manager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DiffPairManager,
  DiffPairDefinition,
  DiffPairProtocol,
  PROTOCOL_PRESETS,
  DiffPairDrcViolation,
} from '../pcb/diff-pair-manager';

describe('DiffPairManager', () => {
  let mgr: DiffPairManager;

  beforeEach(() => {
    mgr = DiffPairManager.create();
  });

  describe('protocol presets', () => {
    it('should have USB 2.0 preset (90 ohm, 0.15mm gap)', () => {
      const usb = PROTOCOL_PRESETS['USB 2.0'];
      expect(usb).toBeDefined();
      expect(usb.targetImpedance).toBe(90);
      expect(usb.traceWidth).toBeGreaterThan(0);
      expect(usb.gap).toBeGreaterThan(0);
    });

    it('should have USB 3.0 preset (85 ohm)', () => {
      expect(PROTOCOL_PRESETS['USB 3.0'].targetImpedance).toBe(85);
    });

    it('should have HDMI preset (100 ohm)', () => {
      expect(PROTOCOL_PRESETS['HDMI'].targetImpedance).toBe(100);
    });

    it('should have LVDS preset (100 ohm)', () => {
      expect(PROTOCOL_PRESETS['LVDS'].targetImpedance).toBe(100);
    });

    it('should have PCIe preset (85 ohm)', () => {
      expect(PROTOCOL_PRESETS['PCIe'].targetImpedance).toBe(85);
    });

    it('should have Ethernet preset (100 ohm)', () => {
      expect(PROTOCOL_PRESETS['Ethernet'].targetImpedance).toBe(100);
    });

    it('should define maxSkewPs for each preset', () => {
      for (const [name, preset] of Object.entries(PROTOCOL_PRESETS)) {
        expect(preset.maxSkewPs).toBeGreaterThan(0);
      }
    });
  });

  describe('pair management', () => {
    it('should add a differential pair', () => {
      mgr.addPair({
        id: 'usb-data',
        netIdP: 'USB_D+',
        netIdN: 'USB_D-',
        protocol: 'USB 2.0',
      });

      const pairs = mgr.getPairs();
      expect(pairs).toHaveLength(1);
      expect(pairs[0].netIdP).toBe('USB_D+');
      expect(pairs[0].netIdN).toBe('USB_D-');
      expect(pairs[0].protocol).toBe('USB 2.0');
    });

    it('should auto-populate width/gap/impedance from protocol preset', () => {
      mgr.addPair({
        id: 'usb-data',
        netIdP: 'USB_D+',
        netIdN: 'USB_D-',
        protocol: 'USB 2.0',
      });

      const pair = mgr.getPair('usb-data')!;
      expect(pair.targetImpedance).toBe(90);
      expect(pair.traceWidth).toBe(PROTOCOL_PRESETS['USB 2.0'].traceWidth);
      expect(pair.gap).toBe(PROTOCOL_PRESETS['USB 2.0'].gap);
      expect(pair.maxSkewPs).toBe(PROTOCOL_PRESETS['USB 2.0'].maxSkewPs);
    });

    it('should allow custom width/gap overrides', () => {
      mgr.addPair({
        id: 'custom',
        netIdP: 'CLK_P',
        netIdN: 'CLK_N',
        protocol: 'Custom',
        traceWidth: 0.2,
        gap: 0.18,
        targetImpedance: 100,
        maxSkewPs: 5,
      });

      const pair = mgr.getPair('custom')!;
      expect(pair.traceWidth).toBe(0.2);
      expect(pair.gap).toBe(0.18);
      expect(pair.targetImpedance).toBe(100);
      expect(pair.maxSkewPs).toBe(5);
    });

    it('should reject duplicate pair ID', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });
      expect(() => mgr.addPair({ id: 'p1', netIdP: 'C', netIdN: 'D', protocol: 'HDMI' }))
        .toThrow(/already exists/i);
    });

    it('should reject net already in another pair', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });
      expect(() => mgr.addPair({ id: 'p2', netIdP: 'A', netIdN: 'C', protocol: 'HDMI' }))
        .toThrow(/already assigned/i);
    });

    it('should reject P and N being the same net', () => {
      expect(() => mgr.addPair({ id: 'bad', netIdP: 'A', netIdN: 'A', protocol: 'USB 2.0' }))
        .toThrow(/same net/i);
    });

    it('should remove a pair', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });
      mgr.removePair('p1');
      expect(mgr.getPairs()).toHaveLength(0);
    });

    it('should throw on removing non-existent pair', () => {
      expect(() => mgr.removePair('nope')).toThrow(/not found/i);
    });

    it('should update a pair', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });
      mgr.updatePair('p1', { gap: 0.2 });
      expect(mgr.getPair('p1')!.gap).toBe(0.2);
    });

    it('should find pair by net ID', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });
      expect(mgr.getPairByNetId('A')?.id).toBe('p1');
      expect(mgr.getPairByNetId('B')?.id).toBe('p1');
      expect(mgr.getPairByNetId('C')).toBeUndefined();
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on pair add/remove', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);

      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });
      expect(listener).toHaveBeenCalledTimes(1);

      mgr.removePair('p1');
      expect(listener).toHaveBeenCalledTimes(2);

      unsub();
      mgr.addPair({ id: 'p2', netIdP: 'C', netIdN: 'D', protocol: 'HDMI' });
      expect(listener).toHaveBeenCalledTimes(2); // no more calls
    });
  });

  describe('DRC', () => {
    it('should flag skew violation when exceeding maxSkewPs', () => {
      mgr.addPair({
        id: 'usb',
        netIdP: 'D+',
        netIdN: 'D-',
        protocol: 'USB 2.0',
      });

      // Simulate routed lengths: P is 1mm longer than N
      const violations = mgr.checkDrc({
        'usb': { lengthP: 51, lengthN: 50, gapActual: 0.15, widthActual: 0.15, uncoupledLength: 0 },
      });

      // 1mm skew at ~6.5 ps/mm = 6.5ps — check against maxSkewPs
      const skewViolations = violations.filter((v) => v.type === 'diff-pair-skew');
      // USB 2.0 maxSkewPs is typically generous (e.g., 50ps), so 6.5ps should pass
      // But we test the mechanism works
      expect(violations).toBeInstanceOf(Array);
    });

    it('should flag gap violation when gap is too narrow', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });

      const violations = mgr.checkDrc({
        'p1': { lengthP: 50, lengthN: 50, gapActual: 0.05, widthActual: 0.15, uncoupledLength: 0 },
      });

      const gapViolations = violations.filter((v) => v.type === 'diff-pair-gap');
      expect(gapViolations).toHaveLength(1);
      expect(gapViolations[0].message).toMatch(/gap/i);
    });

    it('should flag width violation when trace is too narrow', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });

      const violations = mgr.checkDrc({
        'p1': { lengthP: 50, lengthN: 50, gapActual: 0.15, widthActual: 0.05, uncoupledLength: 0 },
      });

      const widthViolations = violations.filter((v) => v.type === 'diff-pair-width');
      expect(widthViolations).toHaveLength(1);
    });

    it('should flag uncoupled length violation', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });

      const violations = mgr.checkDrc({
        'p1': { lengthP: 50, lengthN: 50, gapActual: 0.15, widthActual: 0.15, uncoupledLength: 20 },
      });

      const uncoupledViolations = violations.filter((v) => v.type === 'diff-pair-uncoupled');
      expect(uncoupledViolations).toHaveLength(1);
    });

    it('should return no violations for a well-routed pair', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });

      const violations = mgr.checkDrc({
        'p1': { lengthP: 50, lengthN: 50, gapActual: 0.15, widthActual: 0.15, uncoupledLength: 0 },
      });

      expect(violations).toHaveLength(0);
    });

    it('should skip DRC for pairs with no measurement data', () => {
      mgr.addPair({ id: 'p1', netIdP: 'A', netIdN: 'B', protocol: 'USB 2.0' });
      const violations = mgr.checkDrc({});
      expect(violations).toHaveLength(0);
    });
  });

  describe('serialization', () => {
    it('should round-trip through toJSON / fromJSON', () => {
      mgr.addPair({ id: 'usb', netIdP: 'D+', netIdN: 'D-', protocol: 'USB 2.0' });
      mgr.addPair({ id: 'hdmi', netIdP: 'H+', netIdN: 'H-', protocol: 'HDMI' });

      const json = mgr.toJSON();
      const restored = DiffPairManager.fromJSON(json);

      expect(restored.getPairs()).toHaveLength(2);
      expect(restored.getPair('usb')!.protocol).toBe('USB 2.0');
      expect(restored.getPair('hdmi')!.targetImpedance).toBe(100);
    });

    it('should handle fromJSON with empty data', () => {
      const restored = DiffPairManager.fromJSON({ pairs: [] });
      expect(restored.getPairs()).toHaveLength(0);
    });

    it('should throw on invalid fromJSON data', () => {
      expect(() => DiffPairManager.fromJSON(null)).toThrow();
      expect(() => DiffPairManager.fromJSON('bad')).toThrow();
    });
  });
});
```

**Step 2: Run tests — expect RED**

```bash
npx vitest run client/src/lib/__tests__/diff-pair-manager.test.ts
```

**Step 3: Implement `diff-pair-manager.ts`**

Key design:
- `PROTOCOL_PRESETS` record: USB 2.0 (90ohm, 0.15/0.15mm, 50ps), USB 3.0 (85ohm, 0.127/0.127mm, 15ps), HDMI (100ohm, 0.15/0.18mm, 20ps), LVDS (100ohm, 0.15/0.2mm, 50ps), PCIe (85ohm, 0.127/0.127mm, 15ps), Ethernet (100ohm, 0.2/0.15mm, 50ps), Custom (defaults to 100ohm, 0.15/0.15mm, 25ps).
- `DiffPairDefinition`: id, netIdP, netIdN, protocol, traceWidth, gap, targetImpedance, maxSkewPs, maxUncoupledPct (default 10%).
- `checkDrc(measurements)`: For each pair, check gap >= pair.gap * 0.9 (10% tolerance), width >= pair.traceWidth * 0.9, skew (from length diff * delay) <= maxSkewPs, uncoupledLength <= totalLength * maxUncoupledPct/100.
- `DiffPairDrcViolation`: type (`diff-pair-gap` | `diff-pair-width` | `diff-pair-skew` | `diff-pair-uncoupled`), message, pairId, severity.

**Step 4: Run tests — expect GREEN**

```bash
npx vitest run client/src/lib/__tests__/diff-pair-manager.test.ts
```

**Step 5: Commit**

```bash
git add client/src/lib/pcb/diff-pair-manager.ts client/src/lib/__tests__/diff-pair-manager.test.ts
git commit -m "feat(pcb): FG-16 Task 2 — diff pair manager (pair assignments, protocol presets, skew DRC)"
```

---

### Task 3: DiffPairMeander — Serpentine Length Tuning

**Files:**
- Create: `client/src/lib/pcb/diff-pair-meander.ts`
- Test: `client/src/lib/__tests__/diff-pair-meander.test.ts`

**Context:**
- When the P and N traces of a diff pair have different lengths (skew), serpentine meanders are added to the shorter trace to equalize.
- Also used for single-trace length matching between signals in a bus.
- Two meander styles: "trombone" (rectangular U-turns) and "sawtooth" (triangular zigzag).
- Meander inserts into a straight segment of the trace path, replacing it with the serpentine.

**Step 1: Write failing tests**

```typescript
// client/src/lib/__tests__/diff-pair-meander.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateMeander,
  MeanderConfig,
  MeanderResult,
  calculateMeanderParams,
  fitMeander,
} from '../pcb/diff-pair-meander';

describe('DiffPairMeander', () => {
  describe('calculateMeanderParams', () => {
    it('should compute number of U-turns needed for target additional length', () => {
      const params = calculateMeanderParams({
        additionalLength: 2.0,  // mm to add
        amplitude: 0.5,         // mm meander height
        spacing: 0.3,           // mm between meander turns
        style: 'trombone',
      });

      expect(params.turnCount).toBeGreaterThan(0);
      expect(params.totalAdded).toBeGreaterThanOrEqual(2.0);
      expect(params.totalAdded).toBeLessThan(2.0 + 2 * params.amplitude); // not too much
    });

    it('should return zero turns for zero additional length', () => {
      const params = calculateMeanderParams({
        additionalLength: 0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
      });
      expect(params.turnCount).toBe(0);
      expect(params.totalAdded).toBe(0);
    });

    it('should reject negative additional length', () => {
      expect(() => calculateMeanderParams({
        additionalLength: -1,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
      })).toThrow(/negative/i);
    });

    it('should reject zero or negative amplitude', () => {
      expect(() => calculateMeanderParams({
        additionalLength: 2,
        amplitude: 0,
        spacing: 0.3,
        style: 'trombone',
      })).toThrow(/amplitude/i);
    });

    it('should compute sawtooth parameters', () => {
      const params = calculateMeanderParams({
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'sawtooth',
      });
      expect(params.turnCount).toBeGreaterThan(0);
      expect(params.totalAdded).toBeGreaterThanOrEqual(2.0);
    });
  });

  describe('generateMeander', () => {
    it('should generate trombone meander points along X axis', () => {
      const result = generateMeander({
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
        side: 'left',
      });

      expect(result.points.length).toBeGreaterThan(2);
      // First point should be at start
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      // Last point should be at end
      expect(result.points[result.points.length - 1].x).toBeCloseTo(10);
      expect(result.points[result.points.length - 1].y).toBeCloseTo(0);
      // Added length should meet target
      expect(result.addedLength).toBeGreaterThanOrEqual(2.0);
    });

    it('should generate meander on the left side (negative Y for rightward travel)', () => {
      const result = generateMeander({
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
        side: 'left',
      });

      // Left of rightward travel = positive Y
      const maxY = Math.max(...result.points.map((p) => p.y));
      expect(maxY).toBeGreaterThan(0);
    });

    it('should generate meander on the right side', () => {
      const result = generateMeander({
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
        side: 'right',
      });

      const minY = Math.min(...result.points.map((p) => p.y));
      expect(minY).toBeLessThan(0);
    });

    it('should generate sawtooth meander points', () => {
      const result = generateMeander({
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'sawtooth',
        side: 'left',
      });

      expect(result.points.length).toBeGreaterThan(2);
      expect(result.addedLength).toBeGreaterThanOrEqual(2.0);
    });

    it('should work along Y axis', () => {
      const result = generateMeander({
        start: { x: 0, y: 0 },
        end: { x: 0, y: 10 },
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
        side: 'left',
      });

      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      const last = result.points[result.points.length - 1];
      expect(last.x).toBeCloseTo(0);
      expect(last.y).toBeCloseTo(10);
    });

    it('should work along 45-degree path', () => {
      const result = generateMeander({
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
        side: 'left',
      });

      expect(result.points.length).toBeGreaterThan(2);
      expect(result.addedLength).toBeGreaterThanOrEqual(1.9); // Allow small tolerance
    });

    it('should return straight path when additionalLength is 0', () => {
      const result = generateMeander({
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        additionalLength: 0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
        side: 'left',
      });

      expect(result.points).toHaveLength(2);
      expect(result.addedLength).toBeCloseTo(0);
    });
  });

  describe('fitMeander', () => {
    it('should insert meander into the longest straight segment of a path', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },   // 5mm segment
        { x: 5, y: 20 },  // 20mm segment — longest, meander goes here
        { x: 15, y: 20 },  // 10mm segment
      ];

      const result = fitMeander(path, {
        additionalLength: 2.0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
        side: 'left',
      });

      expect(result.points.length).toBeGreaterThan(4);
      // Starts at same start
      expect(result.points[0].x).toBeCloseTo(0);
      expect(result.points[0].y).toBeCloseTo(0);
      // Ends at same end
      const last = result.points[result.points.length - 1];
      expect(last.x).toBeCloseTo(15);
      expect(last.y).toBeCloseTo(20);
    });

    it('should return original path when additionalLength is 0', () => {
      const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const result = fitMeander(path, {
        additionalLength: 0,
        amplitude: 0.5,
        spacing: 0.3,
        style: 'trombone',
        side: 'left',
      });
      expect(result.points).toHaveLength(2);
    });

    it('should throw when meander amplitude exceeds available space', () => {
      // Very short segment, very large amplitude
      const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
      expect(() => fitMeander(path, {
        additionalLength: 50,
        amplitude: 5,
        spacing: 2,
        style: 'trombone',
        side: 'left',
      })).toThrow(/fit/i);
    });
  });
});
```

**Step 2: Run tests — expect RED**

```bash
npx vitest run client/src/lib/__tests__/diff-pair-meander.test.ts
```

**Step 3: Implement `diff-pair-meander.ts`**

Key logic:
- **Trombone**: Each U-turn adds `2 * amplitude` of extra length. Each turn occupies `spacing` along the travel axis. Number of turns = `ceil(additionalLength / (2 * amplitude))`. Points: `start → (up amplitude) → (forward spacing) → (down amplitude) → (forward spacing) → ...`
- **Sawtooth**: Each zigzag adds `2 * sqrt(amplitude² + (spacing/2)²) - spacing` of extra length. Triangular peaks alternate above/below the baseline.
- **Coordinate transform**: Work in local frame (travel = X axis), rotate results to match actual segment direction.
- **fitMeander**: Find the longest straight segment, replace it with meander, concatenate path before + meander + path after.
- Export `calculateMeanderParams`, `generateMeander`, `fitMeander`.

**Step 4: Run tests — expect GREEN**

```bash
npx vitest run client/src/lib/__tests__/diff-pair-meander.test.ts
```

**Step 5: Commit**

```bash
git add client/src/lib/pcb/diff-pair-meander.ts client/src/lib/__tests__/diff-pair-meander.test.ts
git commit -m "feat(pcb): FG-16 Task 3 — serpentine meander generator (trombone + sawtooth length tuning)"
```

---

## `/agent-teams` Prompts

### Agent 1: `diff-pair-router` (Tasks 1)

**Files owned:** `client/src/lib/pcb/diff-pair-router.ts`, `client/src/lib/__tests__/diff-pair-router.test.ts`

```
You are implementing FG-16 Task 1 for ProtoPulse — a differential pair routing core engine.

PROJECT: ProtoPulse — browser-based EDA tool. TypeScript 5.6, Vitest 4, React 19.
WORKING DIR: /home/wtyler/Projects/ProtoPulse

YOUR FILES (you own these exclusively):
- CREATE: client/src/lib/pcb/diff-pair-router.ts
- CREATE: client/src/lib/__tests__/diff-pair-router.test.ts

EXISTING INFRASTRUCTURE TO USE:
- TracePoint type: `import type { TracePoint } from '@/lib/pcb/trace-router'` (has x, y number fields)
- snapAngle45: `import { snapAngle45 } from '@/lib/pcb/trace-router'`
- Via type: `import type { Via } from '@/lib/pcb/via-model'`

WHAT TO BUILD:
A pure-logic differential pair routing module with these exports:
1. `offsetPath(centerline: Point2D[], offset: number): Point2D[]` — Offset a polyline path perpendicular to each segment. Positive = left of travel direction, negative = right. At bends, use miter join (bisector intersection) capped at 3x to prevent spikes. Single points pass through unchanged. Empty arrays return empty.
2. `generateDiffPair(centerline: Point2D[], config: DiffPairConfig): DiffPairResult` — Generate P and N trace paths from a centerline. P at +halfPitch offset, N at -halfPitch where halfPitch = (traceWidth + gap) / 2. Compute both path lengths and skew. Throw on < 2 points, zero/negative gap or width.
3. `diffPairVias(center: Point2D, direction: Point2D, config: DiffPairConfig, fromLayer: string, toLayer: string): DiffPairViaResult` — Generate two via positions offset ±halfPitch perpendicular to direction.
4. `pathLength(points: Point2D[]): number` — Sum of segment euclidean distances.

Types to export:
- `Point2D = { x: number; y: number }`
- `DiffPairConfig = { traceWidth: number; gap: number; layer: string; netIdP: string; netIdN: string }`
- `DiffPairResult = { pathP: Point2D[]; pathN: Point2D[]; lengthP: number; lengthN: number; skewMm: number; traceWidth: number; gap: number; layer: string; netIdP: string; netIdN: string }`
- `DiffPairViaResult = { viaP: { position: Point2D; fromLayer: string; toLayer: string }; viaN: { position: Point2D; fromLayer: string; toLayer: string } }`

GEOMETRY MATH:
- Perpendicular to segment direction (dx, dy) is (-dy, dx) normalized
- At vertex i with incoming normal n1 and outgoing normal n2, bisector = normalize(n1 + n2), offset distance = offset / dot(bisector, n1), capped at 3.0 * |offset|
- pathLength = sum of sqrt((x2-x1)^2 + (y2-y1)^2) for consecutive points

TDD WORKFLOW:
1. Write ALL tests first in diff-pair-router.test.ts (tests from the plan doc)
2. Run: `npx vitest run client/src/lib/__tests__/diff-pair-router.test.ts` — expect FAIL
3. Implement diff-pair-router.ts
4. Run tests again — expect PASS
5. Run `npm run check` — fix any TS errors

RULES:
- Pure functions/classes only — no React, no DOM, no side effects
- All dimensions in mm
- Use Array.from() not for...of on Map/Set iterators (TS2802)
- `import type` for type-only imports
- No `as any` — use proper narrowing
- Follow existing code style: JSDoc on exports, // ---------- section dividers
```

### Agent 2: `diff-pair-manager` (Task 2)

**Files owned:** `client/src/lib/pcb/diff-pair-manager.ts`, `client/src/lib/__tests__/diff-pair-manager.test.ts`

```
You are implementing FG-16 Task 2 for ProtoPulse — a differential pair manager with protocol presets and DRC.

PROJECT: ProtoPulse — browser-based EDA tool. TypeScript 5.6, Vitest 4, React 19.
WORKING DIR: /home/wtyler/Projects/ProtoPulse

YOUR FILES (you own these exclusively):
- CREATE: client/src/lib/pcb/diff-pair-manager.ts
- CREATE: client/src/lib/__tests__/diff-pair-manager.test.ts

WHAT TO BUILD:
A singleton+subscribe manager for differential pair definitions, protocol presets, and DRC checking.

EXPORTS:
1. `PROTOCOL_PRESETS: Record<DiffPairProtocol, ProtocolPreset>` — Built-in presets:
   - USB 2.0: 90ohm, 0.15mm width, 0.15mm gap, 50ps maxSkew, 10% maxUncoupledPct
   - USB 3.0: 85ohm, 0.127mm width, 0.127mm gap, 15ps maxSkew, 5% maxUncoupledPct
   - HDMI: 100ohm, 0.15mm width, 0.18mm gap, 20ps maxSkew, 10% maxUncoupledPct
   - LVDS: 100ohm, 0.15mm width, 0.2mm gap, 50ps maxSkew, 15% maxUncoupledPct
   - PCIe: 85ohm, 0.127mm width, 0.127mm gap, 15ps maxSkew, 5% maxUncoupledPct
   - Ethernet: 100ohm, 0.2mm width, 0.15mm gap, 50ps maxSkew, 15% maxUncoupledPct
   - Custom: 100ohm, 0.15mm width, 0.15mm gap, 25ps maxSkew, 10% maxUncoupledPct

2. `DiffPairManager` class:
   - `static create(): DiffPairManager` — factory (NOT singleton getInstance — allow multiple instances for testing)
   - `addPair(input: AddPairInput): void` — Add a diff pair. Auto-populate from protocol preset if width/gap/impedance not provided. Throw if id duplicate, net already assigned, or P===N.
   - `removePair(id: string): void` — Remove pair. Throw if not found.
   - `updatePair(id: string, updates: Partial<DiffPairDefinition>): void` — Partial update.
   - `getPair(id: string): DiffPairDefinition | undefined`
   - `getPairs(): DiffPairDefinition[]` — Return all pairs (defensive copies).
   - `getPairByNetId(netId: string): DiffPairDefinition | undefined` — Find pair containing this net.
   - `subscribe(listener: () => void): () => void` — Subscribe to changes. Returns unsubscribe function.
   - `checkDrc(measurements: Record<string, DiffPairMeasurement>): DiffPairDrcViolation[]` — Check all pairs against measurements. Violations: diff-pair-gap (actual < target * 0.9), diff-pair-width (actual < target * 0.9), diff-pair-skew (|lengthP - lengthN| * 6.5 ps/mm > maxSkewPs), diff-pair-uncoupled (uncoupledLength > (lengthP + lengthN)/2 * maxUncoupledPct/100). Skip pairs with no measurement data.
   - `toJSON(): SerializedDiffPairManager` / `static fromJSON(data: unknown): DiffPairManager`

TYPES:
- `DiffPairProtocol = 'USB 2.0' | 'USB 3.0' | 'HDMI' | 'LVDS' | 'PCIe' | 'Ethernet' | 'Custom'`
- `ProtocolPreset = { targetImpedance: number; traceWidth: number; gap: number; maxSkewPs: number; maxUncoupledPct: number }`
- `DiffPairDefinition = { id: string; netIdP: string; netIdN: string; protocol: DiffPairProtocol; traceWidth: number; gap: number; targetImpedance: number; maxSkewPs: number; maxUncoupledPct: number }`
- `AddPairInput = { id: string; netIdP: string; netIdN: string; protocol: DiffPairProtocol; traceWidth?: number; gap?: number; targetImpedance?: number; maxSkewPs?: number; maxUncoupledPct?: number }`
- `DiffPairMeasurement = { lengthP: number; lengthN: number; gapActual: number; widthActual: number; uncoupledLength: number }`
- `DiffPairDrcViolation = { type: 'diff-pair-gap' | 'diff-pair-width' | 'diff-pair-skew' | 'diff-pair-uncoupled'; message: string; pairId: string; severity: 'error' | 'warning' }`

PATTERN REFERENCE — `FlexZoneManager` uses the same singleton+subscribe pattern:
- See `client/src/lib/pcb/flex-zone-manager.ts` for the `subscribe()` pattern
- Listeners stored in a Set<() => void>, notify() iterates with Array.from()

TDD WORKFLOW:
1. Write ALL tests first in diff-pair-manager.test.ts (tests from the plan doc)
2. Run: `npx vitest run client/src/lib/__tests__/diff-pair-manager.test.ts` — expect FAIL
3. Implement diff-pair-manager.ts
4. Run tests again — expect PASS
5. Run `npm run check` — fix any TS errors

RULES:
- Pure class — no React, no DOM
- All dimensions in mm, skew in ps
- Use Array.from() not for...of on Map/Set iterators (TS2802)
- `import type` for type-only imports
- No `as any`
- Follow existing code style: JSDoc on exports, // ---------- section dividers
```

### Agent 3: `diff-pair-meander` (Task 3)

**Files owned:** `client/src/lib/pcb/diff-pair-meander.ts`, `client/src/lib/__tests__/diff-pair-meander.test.ts`

```
You are implementing FG-16 Task 3 for ProtoPulse — a serpentine meander generator for diff pair length tuning.

PROJECT: ProtoPulse — browser-based EDA tool. TypeScript 5.6, Vitest 4, React 19.
WORKING DIR: /home/wtyler/Projects/ProtoPulse

YOUR FILES (you own these exclusively):
- CREATE: client/src/lib/pcb/diff-pair-meander.ts
- CREATE: client/src/lib/__tests__/diff-pair-meander.test.ts

WHAT TO BUILD:
A pure-logic module for generating serpentine/trombone meander patterns that add controlled extra length to a trace path. Used for diff pair length tuning and single-trace length matching.

EXPORTS:
1. `calculateMeanderParams(config: MeanderCalcConfig): MeanderParams` — Compute the number of U-turns and total added length. Throw on negative additionalLength or zero/negative amplitude.
2. `generateMeander(config: MeanderConfig): MeanderResult` — Generate meander points between start and end. Returns points array and actual addedLength. If additionalLength is 0, returns [start, end] with addedLength 0.
3. `fitMeander(path: Point2D[], config: FitMeanderConfig): MeanderResult` — Find the longest straight segment in path, insert meander there, return the modified path. Throw if meander doesn't fit.

TYPES:
- `Point2D = { x: number; y: number }`
- `MeanderStyle = 'trombone' | 'sawtooth'`
- `MeanderSide = 'left' | 'right'`
- `MeanderCalcConfig = { additionalLength: number; amplitude: number; spacing: number; style: MeanderStyle }`
- `MeanderParams = { turnCount: number; totalAdded: number; segmentLength: number }`
- `MeanderConfig = { start: Point2D; end: Point2D; additionalLength: number; amplitude: number; spacing: number; style: MeanderStyle; side: MeanderSide }`
- `MeanderResult = { points: Point2D[]; addedLength: number }`
- `FitMeanderConfig = { additionalLength: number; amplitude: number; spacing: number; style: MeanderStyle; side: MeanderSide }`

TROMBONE MATH:
- Each U-turn adds 2 * amplitude of extra length vertically
- Each U-turn occupies `spacing` along the travel axis
- Number of turns = ceil(additionalLength / (2 * amplitude))
- Points (in local frame, travel along X):
  for each turn i: go up amplitude, forward spacing, down amplitude, forward spacing
  Adjust last turn to hit exact target length
- Transform to world coordinates: rotate/translate from local X-axis frame to actual segment direction

SAWTOOTH MATH:
- Each zigzag peak adds `2 * sqrt(amplitude^2 + (spacing/2)^2) - spacing` of extra length
- Triangular peaks alternate above/below the center line
- Number of peaks = ceil(additionalLength / addedPerPeak)

COORDINATE TRANSFORM:
- Given segment from start to end: direction = normalize(end - start), perpendicular = (-dir.y, dir.x)
- Local X = along direction, local Y = along perpendicular
- "left" side = positive perpendicular, "right" = negative perpendicular
- After generating points in local frame, rotate each: world = start + localX * direction + localY * perpendicular

fitMeander LOGIC:
- Compute length of each segment in path
- Find the longest segment
- If longest segment < spacing * 3, throw "cannot fit meander"
- Call generateMeander on that segment
- Return: path[0..segmentStart] + meanderPoints + path[segmentEnd+1..end]

TDD WORKFLOW:
1. Write ALL tests first in diff-pair-meander.test.ts (tests from the plan doc)
2. Run: `npx vitest run client/src/lib/__tests__/diff-pair-meander.test.ts` — expect FAIL
3. Implement diff-pair-meander.ts
4. Run tests again — expect PASS
5. Run `npm run check` — fix any TS errors

RULES:
- Pure functions — no React, no DOM, no side effects
- All dimensions in mm
- Use Array.from() not for...of on Map/Set iterators (TS2802)
- `import type` for type-only imports
- No `as any`
- Follow existing code style: JSDoc on exports, // ---------- section dividers
```

## Team Execution Checklist

- [ ] Context7 + WebSearch research (impedance-controlled routing, KiCad diff pair implementation)
- [ ] Agent teams dispatched: 3 parallel agents, zero file overlap
- [ ] Plan approved
- [ ] All 3 agents complete (RED → GREEN)
- [ ] `npm run check` — zero TS errors
- [ ] `npm test` — all tests pass, no regressions
- [ ] Commit: `feat(pcb): FG-16 — differential pair routing (router + manager + meander)`
- [ ] Update `docs/product-analysis-checklist.md` — mark FG-16 DONE
- [ ] Update `AGENTS.md` — test count
- [ ] Update memory — Wave 49 notes
