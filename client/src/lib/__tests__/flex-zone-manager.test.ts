import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn<() => string>(() => {
    uuidCounter++;
    return `uuid-${String(uuidCounter).padStart(4, '0')}`;
  }),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn<(key: string) => string | null>((key: string) => store[key] ?? null),
  setItem: vi.fn<(key: string, val: string) => void>((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn<(key: string) => void>((key: string) => {
    delete store[key];
  }),
  clear: vi.fn<() => void>(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// Must import after mocks
// eslint-disable-next-line import-x/first
import {
  FlexZoneManager,
  FLEX_MATERIAL_DATABASE,
} from '../pcb/flex-zone-manager';
// eslint-disable-next-line import-x/first
import type {
  FlexZone,
  FlexMaterial,
  FlexDrcViolation,
  FlexRestrictions,
  TraceSegment,
  ViaPosition,
  ComponentPlacement,
  PourPolygon,
} from '../pcb/flex-zone-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshManager(): FlexZoneManager {
  FlexZoneManager.resetForTesting();
  for (const k of Object.keys(store)) {
    delete store[k];
  }
  uuidCounter = 0;
  return FlexZoneManager.getInstance();
}

/** A simple 10x10 square flex zone centered at (5,5). CCW winding. */
function makeSquareFlexZone(overrides?: Partial<FlexZone>): Omit<FlexZone, 'id'> {
  return {
    name: 'Flex Region 1',
    type: 'flex',
    polygon: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    minBendRadius: 3.0,
    bendType: 'static',
    maxCopperLayers: 2,
    material: 'polyimide_hn',
    restrictions: {
      noSolidCopper: true,
      noPTHVias: true,
      noHeavyComponents: true,
      maxComponentHeight: 2.0,
      preferredTraceDirection: 'perpendicular-to-bend',
      minTraceSpacing: 0.2,
    },
    ...overrides,
  };
}

/** A triangle zone. CCW winding. */
function makeTriangleFlexZone(): Omit<FlexZone, 'id'> {
  return {
    name: 'Flex Triangle',
    type: 'flex',
    polygon: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ],
    minBendRadius: 2.0,
    bendType: 'dynamic',
    maxCopperLayers: 1,
    material: 'polyimide_fn',
    restrictions: {
      noSolidCopper: true,
      noPTHVias: true,
      noHeavyComponents: true,
      maxComponentHeight: 2.0,
      preferredTraceDirection: 'perpendicular-to-bend',
      minTraceSpacing: 0.2,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FlexZoneManager', () => {
  beforeEach(() => {
    freshManager();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = FlexZoneManager.getInstance();
      const b = FlexZoneManager.getInstance();
      expect(a).toBe(b);
    });

    it('resetForTesting creates a new instance', () => {
      const a = FlexZoneManager.getInstance();
      FlexZoneManager.resetForTesting();
      const b = FlexZoneManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Zone CRUD
  // -----------------------------------------------------------------------

  describe('zone CRUD', () => {
    it('adds a zone and returns its id', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('retrieves a zone by id', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const zone = mgr.getZone(id);
      expect(zone).not.toBeNull();
      expect(zone?.name).toBe('Flex Region 1');
      expect(zone?.type).toBe('flex');
      expect(zone?.material).toBe('polyimide_hn');
    });

    it('returns null for non-existent zone id', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.getZone('nonexistent')).toBeNull();
    });

    it('lists all zones', () => {
      const mgr = FlexZoneManager.getInstance();
      mgr.addZone(makeSquareFlexZone());
      mgr.addZone(makeTriangleFlexZone());
      const all = mgr.getAllZones();
      expect(all).toHaveLength(2);
    });

    it('removes a zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      expect(mgr.removeZone(id)).toBe(true);
      expect(mgr.getZone(id)).toBeNull();
      expect(mgr.getAllZones()).toHaveLength(0);
    });

    it('returns false when removing a non-existent zone', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.removeZone('nonexistent')).toBe(false);
    });

    it('updates zone properties', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const updated = mgr.updateZone(id, { name: 'Updated Name', minBendRadius: 5.0 });
      expect(updated).toBe(true);
      const zone = mgr.getZone(id);
      expect(zone?.name).toBe('Updated Name');
      expect(zone?.minBendRadius).toBe(5.0);
    });

    it('returns false when updating a non-existent zone', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.updateZone('nonexistent', { name: 'Nope' })).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Polygon geometry
  // -----------------------------------------------------------------------

  describe('polygon geometry', () => {
    it('detects a point inside a square zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      expect(mgr.isPointInZone(5, 5, id)).toBe(true);
    });

    it('detects a point outside a square zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      expect(mgr.isPointInZone(15, 15, id)).toBe(false);
    });

    it('detects a point inside a triangle zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeTriangleFlexZone());
      expect(mgr.isPointInZone(5, 3, id)).toBe(true);
    });

    it('detects a point outside a triangle zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeTriangleFlexZone());
      expect(mgr.isPointInZone(0, 10, id)).toBe(false);
    });

    it('returns false for point in non-existent zone', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.isPointInZone(5, 5, 'nonexistent')).toBe(false);
    });

    it('finds the zone at a given point', () => {
      const mgr = FlexZoneManager.getInstance();
      mgr.addZone(makeSquareFlexZone());
      const id2 = mgr.addZone({
        ...makeTriangleFlexZone(),
        polygon: [
          { x: 20, y: 20 },
          { x: 30, y: 20 },
          { x: 25, y: 30 },
        ],
      });
      const zone = mgr.getZoneAtPoint(25, 25);
      expect(zone).not.toBeNull();
      expect(zone?.id).toBe(id2);
    });

    it('returns null when no zone contains the point', () => {
      const mgr = FlexZoneManager.getInstance();
      mgr.addZone(makeSquareFlexZone());
      expect(mgr.getZoneAtPoint(100, 100)).toBeNull();
    });

    it('calculates area of a square polygon (CCW)', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const area = mgr.getZoneArea(id);
      expect(area).toBeCloseTo(100.0, 5); // 10x10 = 100
    });

    it('calculates area of a triangle polygon (CCW)', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeTriangleFlexZone());
      const area = mgr.getZoneArea(id);
      expect(area).toBeCloseTo(50.0, 5); // base=10, height=10, area=50
    });

    it('returns 0 area for non-existent zone', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.getZoneArea('nonexistent')).toBe(0);
    });

    it('validates a proper polygon (3+ points, non-zero area)', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.isPolygonValid([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ])).toBe(true);
    });

    it('rejects a polygon with fewer than 3 points', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.isPolygonValid([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ])).toBe(false);
    });

    it('rejects a degenerate polygon (all collinear points)', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.isPolygonValid([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ])).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Bend radius calculation and validation
  // -----------------------------------------------------------------------

  describe('bend radius', () => {
    it('calculates min bend radius for static bend (6x thickness)', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({ bendType: 'static' }));
      // flexThickness = 0.1mm -> 6 * 0.1 = 0.6
      const radius = mgr.calculateMinBendRadius(id, 0.1);
      expect(radius).toBeCloseTo(0.6, 5);
    });

    it('calculates min bend radius for dynamic bend (12x thickness)', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({ bendType: 'dynamic' }));
      // flexThickness = 0.1mm -> 12 * 0.1 = 1.2
      const radius = mgr.calculateMinBendRadius(id, 0.1);
      expect(radius).toBeCloseTo(1.2, 5);
    });

    it('returns 0 for non-existent zone', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.calculateMinBendRadius('nonexistent', 0.1)).toBe(0);
    });

    it('validates bend radius passes when zone radius meets minimum', () => {
      const mgr = FlexZoneManager.getInstance();
      // minBendRadius=3.0mm, static, flexThickness=0.1mm -> min=0.6mm, 3.0 >= 0.6 -> pass
      const id = mgr.addZone(makeSquareFlexZone({ minBendRadius: 3.0, bendType: 'static' }));
      const result = mgr.validateBendRadius(id, 0.1);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('validates bend radius fails when zone radius is below minimum', () => {
      const mgr = FlexZoneManager.getInstance();
      // minBendRadius=0.3mm, static, flexThickness=0.1mm -> min=0.6mm, 0.3 < 0.6 -> fail
      const id = mgr.addZone(makeSquareFlexZone({ minBendRadius: 0.3, bendType: 'static' }));
      const result = mgr.validateBendRadius(id, 0.1);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('bend-radius');
      expect(result.violations[0].ruleRef).toContain('IPC-2223');
    });

    it('validates dynamic bend radius needs larger radius', () => {
      const mgr = FlexZoneManager.getInstance();
      // minBendRadius=1.0mm, dynamic, flexThickness=0.1mm -> min=1.2mm, 1.0 < 1.2 -> fail
      const id = mgr.addZone(makeSquareFlexZone({ minBendRadius: 1.0, bendType: 'dynamic' }));
      const result = mgr.validateBendRadius(id, 0.1);
      expect(result.valid).toBe(false);
    });

    it('validates dynamic bend radius passes with sufficient radius', () => {
      const mgr = FlexZoneManager.getInstance();
      // minBendRadius=2.0mm, dynamic, flexThickness=0.1mm -> min=1.2mm, 2.0 >= 1.2 -> pass
      const id = mgr.addZone(makeSquareFlexZone({ minBendRadius: 2.0, bendType: 'dynamic' }));
      const result = mgr.validateBendRadius(id, 0.1);
      expect(result.valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Via exclusion DRC
  // -----------------------------------------------------------------------

  describe('via exclusion DRC', () => {
    it('flags PTH vias inside flex zone when noPTHVias is true', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const vias: ViaPosition[] = [{ x: 5, y: 5, type: 'through' }];
      const violations = mgr.checkViaExclusion(id, vias);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('via-in-flex');
    });

    it('allows blind vias inside flex zone (only PTH restricted)', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const vias: ViaPosition[] = [{ x: 5, y: 5, type: 'blind' }];
      const violations = mgr.checkViaExclusion(id, vias);
      expect(violations).toHaveLength(0);
    });

    it('does not flag vias outside the flex zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const vias: ViaPosition[] = [{ x: 20, y: 20, type: 'through' }];
      const violations = mgr.checkViaExclusion(id, vias);
      expect(violations).toHaveLength(0);
    });

    it('does not flag vias when noPTHVias is false', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({
        restrictions: {
          ...makeSquareFlexZone().restrictions,
          noPTHVias: false,
        },
      }));
      const vias: ViaPosition[] = [{ x: 5, y: 5, type: 'through' }];
      const violations = mgr.checkViaExclusion(id, vias);
      expect(violations).toHaveLength(0);
    });

    it('flags multiple vias inside the zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const vias: ViaPosition[] = [
        { x: 2, y: 2, type: 'through' },
        { x: 8, y: 8, type: 'through' },
        { x: 5, y: 5, type: 'buried' }, // buried OK
      ];
      const violations = mgr.checkViaExclusion(id, vias);
      expect(violations).toHaveLength(2);
    });

    it('returns empty array for non-existent zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const violations = mgr.checkViaExclusion('nonexistent', [{ x: 5, y: 5, type: 'through' }]);
      expect(violations).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Copper restriction DRC
  // -----------------------------------------------------------------------

  describe('copper restriction DRC', () => {
    it('flags solid copper pours inside flex zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const pours: PourPolygon[] = [{
        polygon: [
          { x: 2, y: 2 },
          { x: 8, y: 2 },
          { x: 8, y: 8 },
          { x: 2, y: 8 },
        ],
        isSolid: true,
      }];
      const violations = mgr.checkCopperRestrictions(id, pours);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('solid-copper');
    });

    it('allows hatched copper pours in flex zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const pours: PourPolygon[] = [{
        polygon: [
          { x: 2, y: 2 },
          { x: 8, y: 2 },
          { x: 8, y: 8 },
          { x: 2, y: 8 },
        ],
        isSolid: false,
      }];
      const violations = mgr.checkCopperRestrictions(id, pours);
      expect(violations).toHaveLength(0);
    });

    it('does not flag pours outside the flex zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const pours: PourPolygon[] = [{
        polygon: [
          { x: 20, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 30 },
          { x: 20, y: 30 },
        ],
        isSolid: true,
      }];
      const violations = mgr.checkCopperRestrictions(id, pours);
      expect(violations).toHaveLength(0);
    });

    it('does not flag solid copper when noSolidCopper is false', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({
        restrictions: {
          ...makeSquareFlexZone().restrictions,
          noSolidCopper: false,
        },
      }));
      const pours: PourPolygon[] = [{
        polygon: [
          { x: 2, y: 2 },
          { x: 8, y: 2 },
          { x: 8, y: 8 },
          { x: 2, y: 8 },
        ],
        isSolid: true,
      }];
      const violations = mgr.checkCopperRestrictions(id, pours);
      expect(violations).toHaveLength(0);
    });

    it('flags partially overlapping pour', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      // Pour that overlaps with the flex zone (partial overlap)
      const pours: PourPolygon[] = [{
        polygon: [
          { x: 5, y: 5 },
          { x: 15, y: 5 },
          { x: 15, y: 15 },
          { x: 5, y: 15 },
        ],
        isSolid: true,
      }];
      const violations = mgr.checkCopperRestrictions(id, pours);
      expect(violations).toHaveLength(1);
    });

    it('returns empty array for non-existent zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const violations = mgr.checkCopperRestrictions('nonexistent', []);
      expect(violations).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Component placement DRC
  // -----------------------------------------------------------------------

  describe('component placement DRC', () => {
    it('flags components too tall for flex zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone()); // maxComponentHeight=2.0
      const components: ComponentPlacement[] = [{
        x: 3, y: 3, width: 2, height: 2, componentHeight: 5.0, refDes: 'U1',
      }];
      const violations = mgr.checkComponentPlacement(id, components);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('component-height');
      expect(violations[0].message).toContain('U1');
    });

    it('allows short components in flex zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const components: ComponentPlacement[] = [{
        x: 3, y: 3, width: 2, height: 2, componentHeight: 1.0, refDes: 'C1',
      }];
      const violations = mgr.checkComponentPlacement(id, components);
      expect(violations).toHaveLength(0);
    });

    it('does not flag components outside flex zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const components: ComponentPlacement[] = [{
        x: 20, y: 20, width: 2, height: 2, componentHeight: 10.0, refDes: 'U2',
      }];
      const violations = mgr.checkComponentPlacement(id, components);
      expect(violations).toHaveLength(0);
    });

    it('flags heavy components when noHeavyComponents is true', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone()); // noHeavyComponents=true, maxComponentHeight=2.0
      const components: ComponentPlacement[] = [{
        x: 3, y: 3, width: 2, height: 2, componentHeight: 3.0, refDes: 'J1',
      }];
      const violations = mgr.checkComponentPlacement(id, components);
      expect(violations).toHaveLength(1);
    });

    it('does not flag components when noHeavyComponents is false', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({
        restrictions: {
          ...makeSquareFlexZone().restrictions,
          noHeavyComponents: false,
        },
      }));
      const components: ComponentPlacement[] = [{
        x: 3, y: 3, width: 2, height: 2, componentHeight: 10.0, refDes: 'U3',
      }];
      const violations = mgr.checkComponentPlacement(id, components);
      expect(violations).toHaveLength(0);
    });

    it('returns empty array for non-existent zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const violations = mgr.checkComponentPlacement('nonexistent', []);
      expect(violations).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Trace direction DRC
  // -----------------------------------------------------------------------

  describe('trace direction DRC', () => {
    it('flags traces parallel to bend axis', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({
        restrictions: {
          ...makeSquareFlexZone().restrictions,
          preferredTraceDirection: 'perpendicular-to-bend',
        },
      }));
      // bendAxis along X (horizontal), trace also horizontal (parallel to bend axis)
      const traces: TraceSegment[] = [{
        p1: { x: 2, y: 5 }, p2: { x: 8, y: 5 },
        width: 0.2, layer: 'F.Cu', netId: 'net-1',
      }];
      const bendAxis = { x: 1, y: 0 }; // horizontal bend axis
      const violations = mgr.checkTraceDirection(id, traces, bendAxis);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('trace-direction');
    });

    it('allows traces perpendicular to bend axis', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      // bendAxis along X (horizontal), trace vertical (perpendicular)
      const traces: TraceSegment[] = [{
        p1: { x: 5, y: 2 }, p2: { x: 5, y: 8 },
        width: 0.2, layer: 'F.Cu', netId: 'net-1',
      }];
      const bendAxis = { x: 1, y: 0 };
      const violations = mgr.checkTraceDirection(id, traces, bendAxis);
      expect(violations).toHaveLength(0);
    });

    it('allows traces at 45 degrees to bend axis (within tolerance)', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      // bendAxis along X, trace at ~45 degrees
      const traces: TraceSegment[] = [{
        p1: { x: 2, y: 2 }, p2: { x: 8, y: 8 },
        width: 0.2, layer: 'F.Cu', netId: 'net-1',
      }];
      const bendAxis = { x: 1, y: 0 };
      const violations = mgr.checkTraceDirection(id, traces, bendAxis);
      // 45 degrees is acceptable — not strictly parallel
      expect(violations).toHaveLength(0);
    });

    it('does not flag traces outside the zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const traces: TraceSegment[] = [{
        p1: { x: 20, y: 20 }, p2: { x: 30, y: 20 },
        width: 0.2, layer: 'F.Cu', netId: 'net-1',
      }];
      const bendAxis = { x: 1, y: 0 };
      const violations = mgr.checkTraceDirection(id, traces, bendAxis);
      expect(violations).toHaveLength(0);
    });

    it('skips check when preferredTraceDirection is any', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({
        restrictions: {
          ...makeSquareFlexZone().restrictions,
          preferredTraceDirection: 'any',
        },
      }));
      const traces: TraceSegment[] = [{
        p1: { x: 2, y: 5 }, p2: { x: 8, y: 5 },
        width: 0.2, layer: 'F.Cu', netId: 'net-1',
      }];
      const bendAxis = { x: 1, y: 0 };
      const violations = mgr.checkTraceDirection(id, traces, bendAxis);
      expect(violations).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Transition stress DRC
  // -----------------------------------------------------------------------

  describe('transition stress DRC', () => {
    it('flags traces crossing flex-rigid transition at sharp angles', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({ type: 'rigid-flex-transition' }));
      // Trace nearly parallel to bottom edge (0,0)-(10,0), crossing it at a very shallow angle.
      // p1 is outside (below bottom edge), p2 is inside. The trace enters at ~1 degree to the edge.
      const traces: TraceSegment[] = [{
        p1: { x: 0, y: -0.1 }, p2: { x: 10, y: 0.1 },
        width: 0.2, layer: 'F.Cu', netId: 'net-1',
      }];
      const violations = mgr.checkTransitionStress(id, traces);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('transition-stress');
    });

    it('allows traces crossing transition zone perpendicularly', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({ type: 'rigid-flex-transition' }));
      // Trace crosses bottom edge perpendicularly (vertical crossing horizontal edge)
      const traces: TraceSegment[] = [{
        p1: { x: 5, y: -5 }, p2: { x: 5, y: 15 },
        width: 0.2, layer: 'F.Cu', netId: 'net-1',
      }];
      const violations = mgr.checkTransitionStress(id, traces);
      expect(violations).toHaveLength(0);
    });

    it('only checks rigid-flex-transition zones', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({ type: 'flex' }));
      // Even a sharp-angle trace should not be flagged in a pure flex zone
      const traces: TraceSegment[] = [{
        p1: { x: -1, y: 0.01 }, p2: { x: 11, y: 0.01 },
        width: 0.2, layer: 'F.Cu', netId: 'net-1',
      }];
      const violations = mgr.checkTransitionStress(id, traces);
      expect(violations).toHaveLength(0);
    });

    it('returns empty array for non-existent zone', () => {
      const mgr = FlexZoneManager.getInstance();
      const violations = mgr.checkTransitionStress('nonexistent', []);
      expect(violations).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Full flex DRC
  // -----------------------------------------------------------------------

  describe('runFlexDRC', () => {
    it('runs all checks and aggregates violations', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const vias: ViaPosition[] = [{ x: 5, y: 5, type: 'through' }];
      const traces: TraceSegment[] = [{
        p1: { x: 2, y: 5 }, p2: { x: 8, y: 5 },
        width: 0.2, layer: 'F.Cu', netId: 'net-1',
      }];
      const pours: PourPolygon[] = [{
        polygon: [
          { x: 2, y: 2 },
          { x: 8, y: 2 },
          { x: 8, y: 8 },
          { x: 2, y: 8 },
        ],
        isSolid: true,
      }];
      const components: ComponentPlacement[] = [{
        x: 3, y: 3, width: 2, height: 2, componentHeight: 5.0, refDes: 'U1',
      }];
      const bendAxis = { x: 1, y: 0 };

      const violations = mgr.runFlexDRC(
        [id],
        vias,
        traces,
        pours,
        components,
        bendAxis,
        0.1,
      );

      // Should have: via-in-flex, solid-copper, component-height, trace-direction
      expect(violations.length).toBeGreaterThanOrEqual(4);
      const types = violations.map((v) => v.type);
      expect(types).toContain('via-in-flex');
      expect(types).toContain('solid-copper');
      expect(types).toContain('component-height');
      expect(types).toContain('trace-direction');
    });

    it('returns empty when no violations exist', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const violations = mgr.runFlexDRC([id], [], [], [], [], { x: 1, y: 0 }, 0.1);
      expect(violations).toHaveLength(0);
    });

    it('handles multiple zones', () => {
      const mgr = FlexZoneManager.getInstance();
      const id1 = mgr.addZone(makeSquareFlexZone());
      const id2 = mgr.addZone({
        ...makeSquareFlexZone(),
        polygon: [
          { x: 20, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 10 },
          { x: 20, y: 10 },
        ],
        name: 'Flex Region 2',
      });
      const vias: ViaPosition[] = [
        { x: 5, y: 5, type: 'through' },
        { x: 25, y: 5, type: 'through' },
      ];
      const violations = mgr.runFlexDRC([id1, id2], vias, [], [], [], { x: 1, y: 0 }, 0.1);
      expect(violations).toHaveLength(2); // one per zone
    });
  });

  // -----------------------------------------------------------------------
  // Material database
  // -----------------------------------------------------------------------

  describe('material database', () => {
    it('has 4 flex materials', () => {
      expect(Object.keys(FLEX_MATERIAL_DATABASE)).toHaveLength(4);
    });

    it('returns material properties by name', () => {
      const mgr = FlexZoneManager.getInstance();
      const mat = mgr.getMaterial('polyimide_hn');
      expect(mat).not.toBeNull();
      expect(mat?.er).toBe(3.4);
      expect(mat?.tanD).toBe(0.003);
      expect(mat?.youngsModulus).toBe(2.5);
    });

    it('returns null for unknown material', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.getMaterial('unobtanium' as FlexMaterial)).toBeNull();
    });

    it('lists all materials', () => {
      const mgr = FlexZoneManager.getInstance();
      const all = mgr.getAllMaterials();
      expect(all).toHaveLength(4);
      const names = all.map((m) => m.name);
      expect(names).toContain('polyimide_hn');
      expect(names).toContain('polyimide_fn');
      expect(names).toContain('coverlay');
      expect(names).toContain('adhesive');
    });

    it('polyimide_hn has correct properties', () => {
      const mat = FLEX_MATERIAL_DATABASE.polyimide_hn;
      expect(mat.tg).toBe(385);
      expect(mat.maxElongation).toBe(70);
      expect(mat.bendCycles).toBeGreaterThanOrEqual(100000);
    });
  });

  // -----------------------------------------------------------------------
  // Persistence (export/import)
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('exports zones as JSON', () => {
      const mgr = FlexZoneManager.getInstance();
      mgr.addZone(makeSquareFlexZone());
      const json = mgr.exportZones();
      const parsed = JSON.parse(json) as { zones: FlexZone[] };
      expect(parsed.zones).toHaveLength(1);
      expect(parsed.zones[0].name).toBe('Flex Region 1');
    });

    it('imports zones from JSON', () => {
      const mgr = FlexZoneManager.getInstance();
      mgr.addZone(makeSquareFlexZone());
      const json = mgr.exportZones();

      // Reset and reimport
      FlexZoneManager.resetForTesting();
      const mgr2 = FlexZoneManager.getInstance();
      const result = mgr2.importZones(json);
      expect(result.success).toBe(true);
      expect(mgr2.getAllZones()).toHaveLength(1);
    });

    it('rejects invalid JSON on import', () => {
      const mgr = FlexZoneManager.getInstance();
      const result = mgr.importZones('not valid json');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('saves to and loads from localStorage', () => {
      const mgr = FlexZoneManager.getInstance();
      mgr.addZone(makeSquareFlexZone());

      // Create a new instance — should load from localStorage
      FlexZoneManager.resetForTesting();
      const mgr2 = FlexZoneManager.getInstance();
      expect(mgr2.getAllZones()).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscription', () => {
    it('notifies listeners on zone add', () => {
      const mgr = FlexZoneManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.addZone(makeSquareFlexZone());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on zone remove', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.removeZone(id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on zone update', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.updateZone(id, { name: 'New Name' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const mgr = FlexZoneManager.getInstance();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.addZone(makeSquareFlexZone());
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty polygon array in zone gracefully', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.isPolygonValid([])).toBe(false);
    });

    it('handles single point polygon', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.isPolygonValid([{ x: 0, y: 0 }])).toBe(false);
    });

    it('handles zero-area zone (all points identical)', () => {
      const mgr = FlexZoneManager.getInstance();
      expect(mgr.isPolygonValid([
        { x: 5, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ])).toBe(false);
    });

    it('handles zones with empty vias/traces/components arrays in DRC', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone());
      expect(mgr.checkViaExclusion(id, [])).toHaveLength(0);
      expect(mgr.checkCopperRestrictions(id, [])).toHaveLength(0);
      expect(mgr.checkComponentPlacement(id, [])).toHaveLength(0);
      expect(mgr.checkTraceDirection(id, [], { x: 1, y: 0 })).toHaveLength(0);
      expect(mgr.checkTransitionStress(id, [])).toHaveLength(0);
    });

    it('handles very large polygon', () => {
      const mgr = FlexZoneManager.getInstance();
      const id = mgr.addZone(makeSquareFlexZone({
        polygon: [
          { x: 0, y: 0 },
          { x: 10000, y: 0 },
          { x: 10000, y: 10000 },
          { x: 0, y: 10000 },
        ],
      }));
      const area = mgr.getZoneArea(id);
      expect(area).toBeCloseTo(100000000, 0); // 10000 * 10000
    });

    it('getAllZones returns copies, not references', () => {
      const mgr = FlexZoneManager.getInstance();
      mgr.addZone(makeSquareFlexZone());
      const zones1 = mgr.getAllZones();
      const zones2 = mgr.getAllZones();
      expect(zones1).not.toBe(zones2);
      expect(zones1[0]).not.toBe(zones2[0]);
    });
  });
});
