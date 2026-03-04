import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub globals before importing the module
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

vi.stubGlobal('performance', {
  now: vi.fn(() => Date.now()),
});

import {
  CopperPourEngine,
  polygonArea,
  pointInPolygon,
  offsetPolygon,
  subtractCircle,
  clipPolygons,
  useCopperPour,
} from '../copper-pour';
import type {
  CopperZone,
  PadObstacle,
  TraceObstacle,
  ViaObstacle,
  Point,
} from '../copper-pour';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSquareBoundary(x: number, y: number, size: number): Point[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

function defaultZoneInput(overrides: Partial<Omit<CopperZone, 'id' | 'filled'>> = {}): Omit<CopperZone, 'id' | 'filled'> {
  return {
    name: 'GND',
    netName: 'GND',
    layer: 'F.Cu',
    pourType: 'solid',
    priority: 0,
    boundary: makeSquareBoundary(0, 0, 1000),
    clearance: 10,
    minWidth: 5,
    thermalRelief: '4-spoke',
    thermalReliefGap: 10,
    thermalReliefWidth: 10,
    isKeepout: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CopperPourEngine', () => {
  let engine: CopperPourEngine;

  beforeEach(() => {
    CopperPourEngine.resetForTesting();
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    engine = CopperPourEngine.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = CopperPourEngine.getInstance();
      const b = CopperPourEngine.getInstance();
      expect(a).toBe(b);
    });

    it('resets for testing', () => {
      const a = CopperPourEngine.getInstance();
      CopperPourEngine.resetForTesting();
      const b = CopperPourEngine.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Zone CRUD
  // -----------------------------------------------------------------------

  describe('zone CRUD', () => {
    it('adds a zone and returns it with id', () => {
      const zone = engine.addZone(defaultZoneInput());
      expect(zone.id).toBeDefined();
      expect(zone.name).toBe('GND');
      expect(zone.netName).toBe('GND');
      expect(zone.filled).toBe(false);
    });

    it('gets a zone by id', () => {
      const zone = engine.addZone(defaultZoneInput());
      const fetched = engine.getZone(zone.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.name).toBe('GND');
    });

    it('returns null for nonexistent zone', () => {
      expect(engine.getZone('nonexistent')).toBeNull();
    });

    it('updates a zone', () => {
      const zone = engine.addZone(defaultZoneInput());
      const result = engine.updateZone(zone.id, { name: 'VCC', netName: 'VCC' });
      expect(result).toBe(true);
      const updated = engine.getZone(zone.id);
      expect(updated?.name).toBe('VCC');
      expect(updated?.netName).toBe('VCC');
    });

    it('returns false when updating nonexistent zone', () => {
      expect(engine.updateZone('nonexistent', { name: 'X' })).toBe(false);
    });

    it('marks zone as unfilled when fill-affecting properties change', () => {
      const zone = engine.addZone(defaultZoneInput());
      engine.fillZone(zone.id);
      expect(engine.getZone(zone.id)?.filled).toBe(true);

      engine.updateZone(zone.id, { clearance: 20 });
      expect(engine.getZone(zone.id)?.filled).toBe(false);
    });

    it('removes a zone', () => {
      const zone = engine.addZone(defaultZoneInput());
      expect(engine.removeZone(zone.id)).toBe(true);
      expect(engine.getZone(zone.id)).toBeNull();
    });

    it('returns false when removing nonexistent zone', () => {
      expect(engine.removeZone('nonexistent')).toBe(false);
    });

    it('getAllZones returns all zones', () => {
      engine.addZone(defaultZoneInput({ name: 'GND' }));
      engine.addZone(defaultZoneInput({ name: 'VCC', netName: 'VCC' }));
      const zones = engine.getAllZones();
      expect(zones).toHaveLength(2);
    });

    it('getZonesByLayer filters by layer', () => {
      engine.addZone(defaultZoneInput({ layer: 'F.Cu' }));
      engine.addZone(defaultZoneInput({ layer: 'B.Cu' }));
      engine.addZone(defaultZoneInput({ layer: 'F.Cu' }));

      expect(engine.getZonesByLayer('F.Cu')).toHaveLength(2);
      expect(engine.getZonesByLayer('B.Cu')).toHaveLength(1);
      expect(engine.getZonesByLayer('In1.Cu')).toHaveLength(0);
    });

    it('getZonesByNet filters by net name', () => {
      engine.addZone(defaultZoneInput({ netName: 'GND' }));
      engine.addZone(defaultZoneInput({ netName: 'VCC' }));
      engine.addZone(defaultZoneInput({ netName: 'GND' }));

      expect(engine.getZonesByNet('GND')).toHaveLength(2);
      expect(engine.getZonesByNet('VCC')).toHaveLength(1);
      expect(engine.getZonesByNet('SIG')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Obstacle Management
  // -----------------------------------------------------------------------

  describe('obstacle management', () => {
    it('adds pad obstacles', () => {
      const pad: PadObstacle = { id: 'p1', center: { x: 100, y: 100 }, width: 60, height: 60, netName: 'VCC' };
      engine.addPadObstacle(pad);
      const obs = engine.getObstacles();
      expect(obs.pads).toHaveLength(1);
      expect(obs.pads[0].id).toBe('p1');
    });

    it('adds trace obstacles', () => {
      const trace: TraceObstacle = {
        id: 't1',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        width: 10,
        netName: 'SIG',
      };
      engine.addTraceObstacle(trace);
      const obs = engine.getObstacles();
      expect(obs.traces).toHaveLength(1);
      expect(obs.traces[0].id).toBe('t1');
    });

    it('adds via obstacles', () => {
      const via: ViaObstacle = {
        id: 'v1',
        center: { x: 200, y: 200 },
        drillDiameter: 20,
        outerDiameter: 40,
        netName: 'VCC',
      };
      engine.addViaObstacle(via);
      const obs = engine.getObstacles();
      expect(obs.vias).toHaveLength(1);
      expect(obs.vias[0].id).toBe('v1');
    });

    it('clears all obstacles', () => {
      engine.addPadObstacle({ id: 'p1', center: { x: 0, y: 0 }, width: 10, height: 10, netName: 'X' });
      engine.addTraceObstacle({ id: 't1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, width: 5, netName: 'X' });
      engine.addViaObstacle({ id: 'v1', center: { x: 0, y: 0 }, drillDiameter: 5, outerDiameter: 10, netName: 'X' });

      engine.clearObstacles();
      const obs = engine.getObstacles();
      expect(obs.pads).toHaveLength(0);
      expect(obs.traces).toHaveLength(0);
      expect(obs.vias).toHaveLength(0);
    });

    it('returns copies of obstacles (immutable)', () => {
      engine.addPadObstacle({ id: 'p1', center: { x: 0, y: 0 }, width: 10, height: 10, netName: 'X' });
      const obs1 = engine.getObstacles();
      const obs2 = engine.getObstacles();
      expect(obs1.pads[0]).not.toBe(obs2.pads[0]);
    });
  });

  // -----------------------------------------------------------------------
  // Polygon Geometry
  // -----------------------------------------------------------------------

  describe('polygonArea', () => {
    it('computes area of a triangle', () => {
      const triangle: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ];
      expect(polygonArea(triangle)).toBe(5000);
    });

    it('computes area of a square', () => {
      const square = makeSquareBoundary(0, 0, 100);
      expect(polygonArea(square)).toBe(10000);
    });

    it('computes area of an irregular polygon', () => {
      // L-shaped polygon
      const lShape: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 100 },
        { x: 0, y: 100 },
      ];
      // Area = 100*50 + 50*50 = 5000 + 2500 = 7500
      expect(polygonArea(lShape)).toBe(7500);
    });

    it('returns positive area regardless of winding direction (CW)', () => {
      const cwSquare: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
      ];
      expect(polygonArea(cwSquare)).toBe(10000);
    });

    it('returns 0 for degenerate polygons', () => {
      expect(polygonArea([])).toBe(0);
      expect(polygonArea([{ x: 0, y: 0 }])).toBe(0);
      expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Point in Polygon
  // -----------------------------------------------------------------------

  describe('pointInPolygon', () => {
    const square = makeSquareBoundary(0, 0, 100);

    it('returns true for point inside', () => {
      expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
    });

    it('returns false for point outside', () => {
      expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
      expect(pointInPolygon({ x: -10, y: 50 }, square)).toBe(false);
    });

    it('handles concave polygon', () => {
      // U-shaped polygon
      const uShape: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 75, y: 100 },
        { x: 75, y: 25 },
        { x: 25, y: 25 },
        { x: 25, y: 100 },
        { x: 0, y: 100 },
      ];
      // Inside the U
      expect(pointInPolygon({ x: 50, y: 10 }, uShape)).toBe(true);
      // In the hollow of the U
      expect(pointInPolygon({ x: 50, y: 75 }, uShape)).toBe(false);
      // In the left arm
      expect(pointInPolygon({ x: 10, y: 50 }, uShape)).toBe(true);
    });

    it('returns false for degenerate polygon', () => {
      expect(pointInPolygon({ x: 0, y: 0 }, [])).toBe(false);
      expect(pointInPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }])).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Offset Polygon
  // -----------------------------------------------------------------------

  describe('offsetPolygon', () => {
    it('returns copy for zero distance', () => {
      const square = makeSquareBoundary(0, 0, 100);
      const result = offsetPolygon(square, 0);
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ x: 0, y: 0 });
      expect(result).not.toBe(square);
    });

    it('expands polygon outward with positive distance', () => {
      const square = makeSquareBoundary(0, 0, 100);
      const expanded = offsetPolygon(square, 10);
      expect(expanded).toHaveLength(4);
      // Expanded polygon should have larger area
      expect(polygonArea(expanded)).toBeGreaterThan(polygonArea(square));
    });

    it('shrinks polygon inward with negative distance', () => {
      const square = makeSquareBoundary(0, 0, 100);
      const shrunk = offsetPolygon(square, -10);
      expect(shrunk).toHaveLength(4);
      // Shrunk polygon should have smaller area
      expect(polygonArea(shrunk)).toBeLessThan(polygonArea(square));
    });

    it('returns copy for degenerate polygon', () => {
      const line: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const result = offsetPolygon(line, 5);
      expect(result).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Subtract Circle
  // -----------------------------------------------------------------------

  describe('subtractCircle', () => {
    it('returns original polygon when circle is outside', () => {
      const square = makeSquareBoundary(0, 0, 100);
      const result = subtractCircle(square, { x: 500, y: 500 }, 10);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(square.length);
    });

    it('modifies polygon when circle is inside', () => {
      const square = makeSquareBoundary(0, 0, 1000);
      const result = subtractCircle(square, { x: 500, y: 500 }, 100, 8);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('handles zero radius', () => {
      const square = makeSquareBoundary(0, 0, 100);
      const result = subtractCircle(square, { x: 50, y: 50 }, 0);
      expect(result).toHaveLength(1);
    });

    it('handles degenerate polygon', () => {
      const result = subtractCircle([], { x: 0, y: 0 }, 10);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Clip Polygons
  // -----------------------------------------------------------------------

  describe('clipPolygons', () => {
    it('returns subject when clip is fully outside', () => {
      const subject = makeSquareBoundary(0, 0, 100);
      const clip = makeSquareBoundary(200, 200, 100);
      const result = clipPolygons(subject, clip);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(4);
    });

    it('returns empty when clip fully covers subject', () => {
      const subject = makeSquareBoundary(25, 25, 50);
      const clip = makeSquareBoundary(0, 0, 100);
      const result = clipPolygons(subject, clip);
      expect(result).toHaveLength(0);
    });

    it('handles partial overlap', () => {
      const subject = makeSquareBoundary(0, 0, 100);
      const clip = makeSquareBoundary(50, 50, 100);
      const result = clipPolygons(subject, clip);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('handles degenerate inputs', () => {
      const square = makeSquareBoundary(0, 0, 100);
      expect(clipPolygons([], square)).toHaveLength(1);
      expect(clipPolygons(square, [])).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Fill Computation
  // -----------------------------------------------------------------------

  describe('fill computation', () => {
    it('fills a simple zone with no obstacles', () => {
      const zone = engine.addZone(defaultZoneInput());
      const result = engine.fillZone(zone.id);

      expect(result.zoneId).toBe(zone.id);
      expect(result.polygons.length).toBeGreaterThanOrEqual(1);
      expect(result.area).toBeGreaterThan(0);
      expect(result.fillTime).toBeGreaterThanOrEqual(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('marks zone as filled after fill', () => {
      const zone = engine.addZone(defaultZoneInput());
      expect(engine.getZone(zone.id)?.filled).toBe(false);
      engine.fillZone(zone.id);
      expect(engine.getZone(zone.id)?.filled).toBe(true);
    });

    it('returns warning for nonexistent zone', () => {
      const result = engine.fillZone('nonexistent');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.polygons).toHaveLength(0);
    });

    it('returns empty fill for pour type none', () => {
      const zone = engine.addZone(defaultZoneInput({ pourType: 'none' }));
      const result = engine.fillZone(zone.id);
      expect(result.polygons).toHaveLength(0);
      expect(result.warnings).toContain('Pour type is none — no fill generated');
    });

    it('fills with pad obstacles on different net (clearance void)', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        clearance: 20,
      }));
      engine.addPadObstacle({
        id: 'p1',
        center: { x: 500, y: 500 },
        width: 60,
        height: 60,
        netName: 'VCC',
      });

      const result = engine.fillZone(zone.id);
      expect(result.polygons.length).toBeGreaterThanOrEqual(1);
      // Area should be less than the full zone area
      expect(result.area).toBeLessThan(1000 * 1000);
    });

    it('fills with same-net pad (thermal relief)', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        thermalRelief: '4-spoke',
        thermalReliefGap: 10,
        thermalReliefWidth: 10,
      }));
      engine.addPadObstacle({
        id: 'p1',
        center: { x: 500, y: 500 },
        width: 60,
        height: 60,
        netName: 'GND', // same net
      });

      const result = engine.fillZone(zone.id);
      expect(result.thermalConnections.length).toBeGreaterThanOrEqual(1);
      expect(result.thermalConnections[0].padId).toBe('p1');
      expect(result.thermalConnections[0].spokeCount).toBe(4);
    });

    it('fills with 2-spoke thermal relief', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        thermalRelief: '2-spoke',
      }));
      engine.addPadObstacle({
        id: 'p1',
        center: { x: 500, y: 500 },
        width: 60,
        height: 60,
        netName: 'GND',
      });

      const result = engine.fillZone(zone.id);
      const conn = result.thermalConnections.find((c) => c.padId === 'p1');
      expect(conn?.spokeCount).toBe(2);
    });

    it('fills with direct thermal relief (no gaps)', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        thermalRelief: 'direct',
      }));
      engine.addPadObstacle({
        id: 'p1',
        center: { x: 500, y: 500 },
        width: 60,
        height: 60,
        netName: 'GND',
      });

      const result = engine.fillZone(zone.id);
      const conn = result.thermalConnections.find((c) => c.padId === 'p1');
      expect(conn?.spokeCount).toBe(0); // direct connection, no spokes
    });

    it('fills with trace obstacles on different net', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        clearance: 10,
      }));
      engine.addTraceObstacle({
        id: 't1',
        start: { x: 200, y: 500 },
        end: { x: 800, y: 500 },
        width: 20,
        netName: 'SIG',
      });

      const result = engine.fillZone(zone.id);
      expect(result.polygons.length).toBeGreaterThanOrEqual(1);
    });

    it('fills with via obstacles on different net', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        clearance: 10,
      }));
      engine.addViaObstacle({
        id: 'v1',
        center: { x: 500, y: 500 },
        drillDiameter: 20,
        outerDiameter: 40,
        netName: 'SIG',
      });

      const result = engine.fillZone(zone.id);
      expect(result.polygons.length).toBeGreaterThanOrEqual(1);
    });

    it('fills with keepout zone on same layer', () => {
      engine.addZone(defaultZoneInput({
        name: 'Keepout',
        netName: '',
        layer: 'F.Cu',
        isKeepout: true,
        boundary: makeSquareBoundary(400, 400, 200),
      }));

      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        layer: 'F.Cu',
      }));

      const result = engine.fillZone(zone.id);
      expect(result.area).toBeLessThan(1000 * 1000);
    });

    it('keepout zone produces no fill itself', () => {
      const keepout = engine.addZone(defaultZoneInput({ isKeepout: true }));
      const result = engine.fillZone(keepout.id);
      expect(result.polygons).toHaveLength(0);
      expect(result.warnings).toContain('Keepout zone — no copper fill');
    });

    it('produces hatched fill', () => {
      const zone = engine.addZone(defaultZoneInput({
        pourType: 'hatched',
        hatchWidth: 10,
        hatchGap: 20,
        boundary: makeSquareBoundary(0, 0, 200),
      }));

      const result = engine.fillZone(zone.id);
      // Hatched fill produces multiple strip polygons
      expect(result.polygons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Priority-based filling
  // -----------------------------------------------------------------------

  describe('priority-based filling', () => {
    it('fillAllZones fills in priority order (lower number first)', () => {
      const z1 = engine.addZone(defaultZoneInput({ name: 'Low', priority: 2 }));
      const z2 = engine.addZone(defaultZoneInput({ name: 'High', priority: 0 }));
      const z3 = engine.addZone(defaultZoneInput({ name: 'Mid', priority: 1 }));

      const results = engine.fillAllZones();
      expect(results).toHaveLength(3);
      // Results should be in priority order
      expect(results[0].zoneId).toBe(z2.id); // priority 0
      expect(results[1].zoneId).toBe(z3.id); // priority 1
      expect(results[2].zoneId).toBe(z1.id); // priority 2
    });

    it('fills all zones and marks them as filled', () => {
      engine.addZone(defaultZoneInput({ priority: 0 }));
      engine.addZone(defaultZoneInput({ priority: 1 }));

      engine.fillAllZones();
      const zones = engine.getAllZones();
      zones.forEach((z) => {
        expect(z.filled).toBe(true);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Zone Conflicts
  // -----------------------------------------------------------------------

  describe('zone conflicts', () => {
    it('detects overlapping zones on same layer', () => {
      engine.addZone(defaultZoneInput({
        name: 'Z1',
        layer: 'F.Cu',
        boundary: makeSquareBoundary(0, 0, 100),
        priority: 0,
      }));
      engine.addZone(defaultZoneInput({
        name: 'Z2',
        layer: 'F.Cu',
        boundary: makeSquareBoundary(50, 50, 100),
        priority: 1,
      }));

      const conflicts = engine.detectConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].overlapArea).toBeGreaterThan(0);
      expect(conflicts[0].resolution).toBe('priority'); // different priorities
    });

    it('reports error resolution when priorities are equal', () => {
      engine.addZone(defaultZoneInput({
        name: 'Z1',
        layer: 'F.Cu',
        boundary: makeSquareBoundary(0, 0, 100),
        priority: 0,
      }));
      engine.addZone(defaultZoneInput({
        name: 'Z2',
        layer: 'F.Cu',
        boundary: makeSquareBoundary(50, 50, 100),
        priority: 0,
      }));

      const conflicts = engine.detectConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].resolution).toBe('error');
    });

    it('does not report conflict for zones on different layers', () => {
      engine.addZone(defaultZoneInput({
        name: 'Z1',
        layer: 'F.Cu',
        boundary: makeSquareBoundary(0, 0, 100),
      }));
      engine.addZone(defaultZoneInput({
        name: 'Z2',
        layer: 'B.Cu',
        boundary: makeSquareBoundary(0, 0, 100),
      }));

      const conflicts = engine.detectConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('does not report conflict for non-overlapping zones', () => {
      engine.addZone(defaultZoneInput({
        name: 'Z1',
        layer: 'F.Cu',
        boundary: makeSquareBoundary(0, 0, 100),
      }));
      engine.addZone(defaultZoneInput({
        name: 'Z2',
        layer: 'F.Cu',
        boundary: makeSquareBoundary(200, 200, 100),
      }));

      const conflicts = engine.detectConflicts();
      expect(conflicts).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Unfill
  // -----------------------------------------------------------------------

  describe('unfill', () => {
    it('unfills a single zone', () => {
      const zone = engine.addZone(defaultZoneInput());
      engine.fillZone(zone.id);
      expect(engine.getZone(zone.id)?.filled).toBe(true);

      engine.unfillZone(zone.id);
      expect(engine.getZone(zone.id)?.filled).toBe(false);
    });

    it('unfills all zones', () => {
      const z1 = engine.addZone(defaultZoneInput({ priority: 0 }));
      const z2 = engine.addZone(defaultZoneInput({ priority: 1 }));
      engine.fillAllZones();

      engine.unfillAll();
      expect(engine.getZone(z1.id)?.filled).toBe(false);
      expect(engine.getZone(z2.id)?.filled).toBe(false);
    });

    it('unfillZone is a no-op for nonexistent zone', () => {
      // Should not throw
      engine.unfillZone('nonexistent');
    });
  });

  // -----------------------------------------------------------------------
  // Export / Import
  // -----------------------------------------------------------------------

  describe('export / import', () => {
    it('round-trips zones via export/import', () => {
      engine.addZone(defaultZoneInput({ name: 'GND' }));
      engine.addZone(defaultZoneInput({ name: 'VCC', netName: 'VCC' }));

      const exported = engine.exportZones();
      const parsed = JSON.parse(exported);
      expect(parsed.zones).toHaveLength(2);

      // Reset and import
      engine.clear();
      expect(engine.getAllZones()).toHaveLength(0);

      const result = engine.importZones(exported);
      expect(result.imported).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(engine.getAllZones()).toHaveLength(2);
    });

    it('handles malformed JSON on import', () => {
      const result = engine.importZones('not json');
      expect(result.imported).toBe(0);
      expect(result.errors).toContain('Invalid JSON');
    });

    it('handles invalid format on import', () => {
      const result = engine.importZones('"just a string"');
      expect(result.imported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles missing zones array', () => {
      const result = engine.importZones('{"zones": "not an array"}');
      expect(result.imported).toBe(0);
      expect(result.errors).toContain('Invalid format: missing zones array');
    });

    it('reports errors for invalid zone entries', () => {
      const json = JSON.stringify({ zones: [{ invalid: true }, { name: 'OK', netName: 'GND', layer: 'F.Cu', boundary: [] }] });
      const result = engine.importZones(json);
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles zone with empty boundary', () => {
      const zone = engine.addZone(defaultZoneInput({ boundary: [] }));
      const result = engine.fillZone(zone.id);
      // Empty boundary should still produce a result (degenerate polygon)
      expect(result.zoneId).toBe(zone.id);
    });

    it('handles zone with single point boundary', () => {
      const zone = engine.addZone(defaultZoneInput({ boundary: [{ x: 0, y: 0 }] }));
      const result = engine.fillZone(zone.id);
      expect(result.zoneId).toBe(zone.id);
    });

    it('handles collinear points', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
        ],
      }));
      const result = engine.fillZone(zone.id);
      expect(result.area).toBe(0);
    });

    it('handles zero clearance', () => {
      const zone = engine.addZone(defaultZoneInput({
        clearance: 0,
        boundary: makeSquareBoundary(0, 0, 1000),
      }));
      engine.addPadObstacle({
        id: 'p1',
        center: { x: 500, y: 500 },
        width: 60,
        height: 60,
        netName: 'VCC',
      });

      const result = engine.fillZone(zone.id);
      // Should still compute without errors
      expect(result.zoneId).toBe(zone.id);
    });
  });

  // -----------------------------------------------------------------------
  // localStorage Persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('persists zones to localStorage', () => {
      engine.addZone(defaultZoneInput({ name: 'GND' }));
      expect(localStorage.setItem).toHaveBeenCalled();

      const saved = store['protopulse-copper-pour'];
      expect(saved).toBeDefined();
      const parsed = JSON.parse(saved);
      expect(parsed.zones).toHaveLength(1);
    });

    it('loads zones from localStorage on construction', () => {
      // Pre-populate localStorage
      const zoneData = {
        zones: [
          {
            id: 'existing-zone',
            name: 'Persisted',
            netName: 'GND',
            layer: 'F.Cu',
            pourType: 'solid',
            priority: 0,
            boundary: makeSquareBoundary(0, 0, 100),
            clearance: 10,
            minWidth: 5,
            thermalRelief: '4-spoke',
            thermalReliefGap: 10,
            thermalReliefWidth: 10,
            isKeepout: false,
            filled: false,
          },
        ],
      };
      store['protopulse-copper-pour'] = JSON.stringify(zoneData);

      CopperPourEngine.resetForTesting();
      const newEngine = CopperPourEngine.getInstance();
      const zones = newEngine.getAllZones();
      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe('Persisted');
    });

    it('handles corrupt localStorage data gracefully', () => {
      store['protopulse-copper-pour'] = 'not valid json!!!';
      CopperPourEngine.resetForTesting();
      // Should not throw
      const newEngine = CopperPourEngine.getInstance();
      expect(newEngine.getAllZones()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / Notify
  // -----------------------------------------------------------------------

  describe('subscribe / notify', () => {
    it('notifies subscribers on zone add', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.addZone(defaultZoneInput());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on zone remove', () => {
      const zone = engine.addZone(defaultZoneInput());
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.removeZone(zone.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on zone update', () => {
      const zone = engine.addZone(defaultZoneInput());
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.updateZone(zone.id, { name: 'Updated' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on fill', () => {
      const zone = engine.addZone(defaultZoneInput());
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.fillZone(zone.id);
      expect(listener).toHaveBeenCalled();
    });

    it('notifies subscribers on unfill', () => {
      const zone = engine.addZone(defaultZoneInput());
      engine.fillZone(zone.id);
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.unfillZone(zone.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on clear', () => {
      engine.addZone(defaultZoneInput());
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.clear();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);
      unsub();
      engine.addZone(defaultZoneInput());
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      engine.subscribe(listener1);
      engine.subscribe(listener2);
      engine.addZone(defaultZoneInput());
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  describe('clear', () => {
    it('clears all state', () => {
      engine.addZone(defaultZoneInput());
      engine.addPadObstacle({ id: 'p1', center: { x: 0, y: 0 }, width: 10, height: 10, netName: 'X' });
      engine.addTraceObstacle({ id: 't1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, width: 5, netName: 'X' });
      engine.addViaObstacle({ id: 'v1', center: { x: 0, y: 0 }, drillDiameter: 5, outerDiameter: 10, netName: 'X' });

      engine.clear();
      expect(engine.getAllZones()).toHaveLength(0);
      const obs = engine.getObstacles();
      expect(obs.pads).toHaveLength(0);
      expect(obs.traces).toHaveLength(0);
      expect(obs.vias).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Hook shape
  // -----------------------------------------------------------------------

  describe('useCopperPour hook', () => {
    it('exports the expected shape', () => {
      // Just verify the hook is a function that returns the right shape
      expect(typeof useCopperPour).toBe('function');
    });
  });

  // -----------------------------------------------------------------------
  // Additional geometry edge cases
  // -----------------------------------------------------------------------

  describe('additional geometry', () => {
    it('polygonArea of a large polygon', () => {
      const bigSquare = makeSquareBoundary(0, 0, 10000);
      expect(polygonArea(bigSquare)).toBe(100000000);
    });

    it('pointInPolygon for point far away', () => {
      const square = makeSquareBoundary(0, 0, 100);
      expect(pointInPolygon({ x: 99999, y: 99999 }, square)).toBe(false);
    });

    it('offsetPolygon handles triangle', () => {
      const triangle: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ];
      const expanded = offsetPolygon(triangle, 5);
      expect(expanded).toHaveLength(3);
      expect(polygonArea(expanded)).toBeGreaterThan(polygonArea(triangle));
    });

    it('subtractCircle with many segments', () => {
      const square = makeSquareBoundary(0, 0, 1000);
      const result = subtractCircle(square, { x: 500, y: 500 }, 100, 32);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Multiple obstacle interactions
  // -----------------------------------------------------------------------

  describe('multiple obstacles', () => {
    it('handles multiple pad obstacles', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        clearance: 10,
      }));

      for (let i = 0; i < 5; i++) {
        engine.addPadObstacle({
          id: `p${i}`,
          center: { x: 100 + i * 200, y: 500 },
          width: 40,
          height: 40,
          netName: 'VCC',
        });
      }

      const result = engine.fillZone(zone.id);
      expect(result.zoneId).toBe(zone.id);
      expect(result.area).toBeLessThan(1000 * 1000);
    });

    it('handles mixed obstacle types', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        clearance: 10,
      }));

      engine.addPadObstacle({
        id: 'p1',
        center: { x: 200, y: 500 },
        width: 60,
        height: 60,
        netName: 'VCC',
      });
      engine.addTraceObstacle({
        id: 't1',
        start: { x: 400, y: 400 },
        end: { x: 600, y: 600 },
        width: 20,
        netName: 'SIG',
      });
      engine.addViaObstacle({
        id: 'v1',
        center: { x: 800, y: 500 },
        drillDiameter: 20,
        outerDiameter: 40,
        netName: 'SIG2',
      });

      const result = engine.fillZone(zone.id);
      expect(result.zoneId).toBe(zone.id);
      // Verify obstacles were processed (polygons generated, no errors)
      expect(result.polygons.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings).toHaveLength(0);

      // Compare against a zone with no obstacles to verify subtraction occurred.
      // The simplified clip algorithm uses bridge vertices to cut holes,
      // so the resulting polygon has more vertices than the clean boundary.
      engine.clearObstacles();
      engine.unfillZone(zone.id);
      const baseResult = engine.fillZone(zone.id);
      const obstacleVertexCount = result.polygons.reduce((sum, p) => sum + p.length, 0);
      const baseVertexCount = baseResult.polygons.reduce((sum, p) => sum + p.length, 0);
      expect(obstacleVertexCount).toBeGreaterThan(baseVertexCount);
    });
  });

  // -----------------------------------------------------------------------
  // Same-net obstacles are not subtracted
  // -----------------------------------------------------------------------

  describe('same-net behavior', () => {
    it('does not subtract same-net trace obstacles', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        clearance: 10,
      }));

      // Same net trace — should NOT create void
      engine.addTraceObstacle({
        id: 't1',
        start: { x: 200, y: 500 },
        end: { x: 800, y: 500 },
        width: 20,
        netName: 'GND', // same net as zone
      });

      const resultWithSameNet = engine.fillZone(zone.id);

      engine.clearObstacles();
      engine.unfillZone(zone.id);
      const resultWithout = engine.fillZone(zone.id);

      // Same net trace should not reduce area
      expect(resultWithSameNet.area).toEqual(resultWithout.area);
    });

    it('does not subtract same-net via obstacles', () => {
      const zone = engine.addZone(defaultZoneInput({
        boundary: makeSquareBoundary(0, 0, 1000),
        clearance: 10,
      }));

      engine.addViaObstacle({
        id: 'v1',
        center: { x: 500, y: 500 },
        drillDiameter: 20,
        outerDiameter: 40,
        netName: 'GND', // same net
      });

      const resultWithSameNet = engine.fillZone(zone.id);

      engine.clearObstacles();
      engine.unfillZone(zone.id);
      const resultWithout = engine.fillZone(zone.id);

      expect(resultWithSameNet.area).toEqual(resultWithout.area);
    });
  });
});
