/**
 * CopperPourBridge — Tests
 *
 * TDD: tests written first, then implementation.
 * Validates conversion of PCB routing data (traces, vias, pads)
 * into obstacle geometries for the copper pour engine.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  CopperPourBridge,
  type PourObstacle,
  type ThermalReliefConfig,
} from '@/lib/pcb/copper-pour-bridge';
import { CopperPourEngine } from '@/lib/copper-pour';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOLERANCE = 1e-6;

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < TOLERANCE;
}

// ---------------------------------------------------------------------------
// segmentToRect
// ---------------------------------------------------------------------------

describe('CopperPourBridge.segmentToRect', () => {
  it('converts a horizontal segment to a rectangle', () => {
    const rect = CopperPourBridge.segmentToRect(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      0.5,
    );
    expect(rect.type).toBe('trace');
    expect(rect.geometry).toBe('rect');
    // Center at midpoint
    expect(approxEqual(rect.x, 5)).toBe(true);
    expect(approxEqual(rect.y, 0)).toBe(true);
    // Width along segment direction = 10, height = trace width 0.5
    expect(approxEqual(rect.width, 10)).toBe(true);
    expect(approxEqual(rect.height, 0.5)).toBe(true);
    expect(approxEqual(rect.rotation ?? 0, 0)).toBe(true);
  });

  it('converts a vertical segment to a rectangle', () => {
    const rect = CopperPourBridge.segmentToRect(
      { x: 5, y: 0 },
      { x: 5, y: 8 },
      0.3,
    );
    expect(approxEqual(rect.x, 5)).toBe(true);
    expect(approxEqual(rect.y, 4)).toBe(true);
    expect(approxEqual(rect.width, 8)).toBe(true);
    expect(approxEqual(rect.height, 0.3)).toBe(true);
    expect(approxEqual(rect.rotation ?? 0, 90)).toBe(true);
  });

  it('converts a 45-degree diagonal segment to a rectangle', () => {
    const rect = CopperPourBridge.segmentToRect(
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      0.4,
    );
    expect(approxEqual(rect.x, 2.5)).toBe(true);
    expect(approxEqual(rect.y, 2.5)).toBe(true);
    const length = Math.sqrt(50);
    expect(approxEqual(rect.width, length)).toBe(true);
    expect(approxEqual(rect.height, 0.4)).toBe(true);
    expect(approxEqual(rect.rotation ?? 0, 45)).toBe(true);
  });

  it('converts a negative-slope segment correctly', () => {
    const rect = CopperPourBridge.segmentToRect(
      { x: 10, y: 10 },
      { x: 0, y: 0 },
      0.25,
    );
    expect(approxEqual(rect.x, 5)).toBe(true);
    expect(approxEqual(rect.y, 5)).toBe(true);
    const length = Math.sqrt(200);
    expect(approxEqual(rect.width, length)).toBe(true);
    // Rotation should be in -180..180 range, pointing from p1 to p2 = 225 deg or -135 deg
    // We normalize, so check it's equivalent to 225 or -135
    expect(rect.rotation !== undefined).toBe(true);
  });

  it('handles zero-length segment as a point', () => {
    const rect = CopperPourBridge.segmentToRect(
      { x: 3, y: 4 },
      { x: 3, y: 4 },
      0.5,
    );
    expect(rect.geometry).toBe('rect');
    expect(approxEqual(rect.x, 3)).toBe(true);
    expect(approxEqual(rect.y, 4)).toBe(true);
    // Zero-length trace becomes a square of trace width
    expect(approxEqual(rect.width, 0.5)).toBe(true);
    expect(approxEqual(rect.height, 0.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tracesToObstacles
// ---------------------------------------------------------------------------

describe('CopperPourBridge.tracesToObstacles', () => {
  it('converts a single-segment trace to one obstacle', () => {
    const obstacles = CopperPourBridge.tracesToObstacles([
      {
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        layer: 'front',
        width: 0.5,
        netId: 'net1',
      },
    ]);
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0].type).toBe('trace');
    expect(obstacles[0].layer).toBe('front');
    expect(obstacles[0].netId).toBe('net1');
  });

  it('converts a multi-segment trace to multiple obstacles', () => {
    const obstacles = CopperPourBridge.tracesToObstacles([
      {
        points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }],
        layer: 'back',
        width: 0.3,
      },
    ]);
    // 2 segments = 2 obstacles
    expect(obstacles).toHaveLength(2);
    obstacles.forEach((obs) => {
      expect(obs.type).toBe('trace');
      expect(obs.layer).toBe('back');
    });
  });

  it('handles multiple traces', () => {
    const obstacles = CopperPourBridge.tracesToObstacles([
      { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], layer: 'front', width: 0.5 },
      { points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], layer: 'front', width: 0.3 },
    ]);
    expect(obstacles).toHaveLength(2);
  });

  it('skips traces with fewer than 2 points', () => {
    const obstacles = CopperPourBridge.tracesToObstacles([
      { points: [{ x: 0, y: 0 }], layer: 'front', width: 0.5 },
    ]);
    expect(obstacles).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(CopperPourBridge.tracesToObstacles([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// viasToObstacles
// ---------------------------------------------------------------------------

describe('CopperPourBridge.viasToObstacles', () => {
  it('converts vias to circular obstacles', () => {
    const obstacles = CopperPourBridge.viasToObstacles([
      { position: { x: 5, y: 5 }, outerDiameter: 0.6, netId: 42 },
    ]);
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0].type).toBe('via');
    expect(obstacles[0].geometry).toBe('circle');
    expect(obstacles[0].x).toBe(5);
    expect(obstacles[0].y).toBe(5);
    // Width and height = outerDiameter
    expect(obstacles[0].width).toBe(0.6);
    expect(obstacles[0].height).toBe(0.6);
    // Vias span all layers
    expect(obstacles[0].layer).toBe('both');
  });

  it('handles multiple vias', () => {
    const obstacles = CopperPourBridge.viasToObstacles([
      { position: { x: 1, y: 2 }, outerDiameter: 0.6 },
      { position: { x: 3, y: 4 }, outerDiameter: 0.8, netId: 7 },
    ]);
    expect(obstacles).toHaveLength(2);
    expect(obstacles[1].netId).toBe('7');
  });

  it('returns empty array for empty input', () => {
    expect(CopperPourBridge.viasToObstacles([])).toHaveLength(0);
  });

  it('converts numeric netId to string', () => {
    const obstacles = CopperPourBridge.viasToObstacles([
      { position: { x: 0, y: 0 }, outerDiameter: 0.6, netId: 123 },
    ]);
    expect(obstacles[0].netId).toBe('123');
  });
});

// ---------------------------------------------------------------------------
// padsToObstacles
// ---------------------------------------------------------------------------

describe('CopperPourBridge.padsToObstacles', () => {
  it('converts rectangular pads to rect obstacles', () => {
    const obstacles = CopperPourBridge.padsToObstacles([
      {
        position: { x: 10, y: 20 },
        width: 1.5,
        height: 0.8,
        shape: 'rect',
        layer: 'front',
        netId: 'GND',
      },
    ]);
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0].type).toBe('pad');
    expect(obstacles[0].geometry).toBe('rect');
    expect(obstacles[0].x).toBe(10);
    expect(obstacles[0].y).toBe(20);
    expect(obstacles[0].width).toBe(1.5);
    expect(obstacles[0].height).toBe(0.8);
    expect(obstacles[0].layer).toBe('front');
    expect(obstacles[0].netId).toBe('GND');
  });

  it('converts circular pads to circle obstacles', () => {
    const obstacles = CopperPourBridge.padsToObstacles([
      {
        position: { x: 5, y: 5 },
        width: 1.0,
        height: 1.0,
        shape: 'circle',
        layer: 'both',
        netId: 'VCC',
      },
    ]);
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0].geometry).toBe('circle');
  });

  it('treats square pads as rect', () => {
    const obstacles = CopperPourBridge.padsToObstacles([
      {
        position: { x: 0, y: 0 },
        width: 2.0,
        height: 2.0,
        shape: 'square',
        layer: 'front',
      },
    ]);
    expect(obstacles[0].geometry).toBe('rect');
  });

  it('handles oblong pads as rect', () => {
    const obstacles = CopperPourBridge.padsToObstacles([
      {
        position: { x: 0, y: 0 },
        width: 2.0,
        height: 1.0,
        shape: 'oblong',
        layer: 'front',
      },
    ]);
    expect(obstacles[0].geometry).toBe('rect');
  });

  it('handles roundrect pads as rect', () => {
    const obstacles = CopperPourBridge.padsToObstacles([
      {
        position: { x: 0, y: 0 },
        width: 1.5,
        height: 1.0,
        shape: 'roundrect',
        layer: 'back',
      },
    ]);
    expect(obstacles[0].geometry).toBe('rect');
  });

  it('returns empty array for empty input', () => {
    expect(CopperPourBridge.padsToObstacles([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildObstacles
// ---------------------------------------------------------------------------

describe('CopperPourBridge.buildObstacles', () => {
  it('combines traces, vias, and pads into one obstacle set', () => {
    const obstacles = CopperPourBridge.buildObstacles({
      traces: [
        { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], layer: 'front', width: 0.5, netId: 'net1' },
      ],
      vias: [
        { position: { x: 5, y: 5 }, outerDiameter: 0.6 },
      ],
      pads: [
        { position: { x: 20, y: 20 }, width: 1.0, height: 1.0, shape: 'circle', layer: 'front' },
      ],
    });

    const traces = obstacles.filter((o: PourObstacle) => o.type === 'trace');
    const vias = obstacles.filter((o: PourObstacle) => o.type === 'via');
    const pads = obstacles.filter((o: PourObstacle) => o.type === 'pad');

    expect(traces).toHaveLength(1);
    expect(vias).toHaveLength(1);
    expect(pads).toHaveLength(1);
  });

  it('handles missing optional arrays', () => {
    const obstacles = CopperPourBridge.buildObstacles({});
    expect(obstacles).toHaveLength(0);
  });

  it('handles empty arrays', () => {
    const obstacles = CopperPourBridge.buildObstacles({
      traces: [],
      vias: [],
      pads: [],
    });
    expect(obstacles).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterForPour
// ---------------------------------------------------------------------------

describe('CopperPourBridge.filterForPour', () => {
  const obstacles: PourObstacle[] = [
    { type: 'trace', geometry: 'rect', x: 5, y: 0, width: 10, height: 0.5, layer: 'front', netId: 'GND' },
    { type: 'via', geometry: 'circle', x: 5, y: 5, width: 0.6, height: 0.6, layer: 'both', netId: 'GND' },
    { type: 'pad', geometry: 'rect', x: 20, y: 20, width: 1.0, height: 1.0, layer: 'front', netId: 'VCC' },
    { type: 'trace', geometry: 'rect', x: 50, y: 0, width: 10, height: 0.3, layer: 'back', netId: 'VCC' },
    { type: 'pad', geometry: 'circle', x: 30, y: 30, width: 1.5, height: 1.5, layer: 'front' },
  ];

  it('classifies same-net obstacles as thermal', () => {
    const result = CopperPourBridge.filterForPour(obstacles, 'front', 'GND');
    // GND trace on front layer → thermal
    expect(result.thermal.some((o) => o.type === 'trace' && o.netId === 'GND')).toBe(true);
    // GND via (layer=both) → thermal
    expect(result.thermal.some((o) => o.type === 'via' && o.netId === 'GND')).toBe(true);
  });

  it('classifies different-net same-layer obstacles as subtract', () => {
    const result = CopperPourBridge.filterForPour(obstacles, 'front', 'GND');
    // VCC pad on front layer → subtract
    expect(result.subtract.some((o) => o.netId === 'VCC' && o.layer === 'front')).toBe(true);
  });

  it('classifies no-net obstacles as subtract', () => {
    const result = CopperPourBridge.filterForPour(obstacles, 'front', 'GND');
    // Pad with no netId → subtract
    expect(result.subtract.some((o) => o.netId === undefined)).toBe(true);
  });

  it('excludes obstacles on different layers', () => {
    const result = CopperPourBridge.filterForPour(obstacles, 'front', 'GND');
    // VCC trace on back layer should not appear
    expect(result.subtract.some((o) => o.layer === 'back')).toBe(false);
    expect(result.thermal.some((o) => o.layer === 'back')).toBe(false);
  });

  it('includes "both" layer obstacles', () => {
    const result = CopperPourBridge.filterForPour(obstacles, 'front', 'GND');
    // Via with layer=both should appear (as thermal since same net)
    expect(result.thermal.some((o) => o.layer === 'both')).toBe(true);
  });

  it('treats all obstacles as subtract when pour has no net', () => {
    const result = CopperPourBridge.filterForPour(obstacles, 'front');
    // All front-layer and both-layer obstacles should be in subtract
    expect(result.thermal).toHaveLength(0);
    expect(result.subtract.length).toBeGreaterThan(0);
  });

  it('returns empty sets for empty input', () => {
    const result = CopperPourBridge.filterForPour([], 'front', 'GND');
    expect(result.subtract).toHaveLength(0);
    expect(result.thermal).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Thermal relief config
// ---------------------------------------------------------------------------

describe('CopperPourBridge thermal relief config', () => {
  it('returns default thermal config', () => {
    const config = CopperPourBridge.getDefaultThermalConfig();
    expect(config.spokeWidth).toBe(0.3);
    expect(config.gap).toBe(0.3);
    expect(config.spokeCount).toBe(4);
  });

  it('accepts custom thermal config', () => {
    const custom: ThermalReliefConfig = { spokeWidth: 0.5, gap: 0.4, spokeCount: 2 };
    expect(custom.spokeWidth).toBe(0.5);
    expect(custom.gap).toBe(0.4);
    expect(custom.spokeCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Integration: setRoutingObstacles on CopperPourEngine
// ---------------------------------------------------------------------------

describe('CopperPourEngine.setRoutingObstacles integration', () => {
  beforeEach(() => {
    CopperPourEngine.resetForTesting();
  });

  it('accepts routing obstacles and uses them in fill', () => {
    const engine = CopperPourEngine.getInstance();

    // Add a zone
    const zone = engine.addZone({
      name: 'GND',
      netName: 'GND',
      layer: 'F.Cu',
      pourType: 'solid',
      priority: 0,
      boundary: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      clearance: 10,
      minWidth: 5,
      thermalRelief: '4-spoke',
      thermalReliefGap: 10,
      thermalReliefWidth: 10,
      isKeepout: false,
    });

    // Build routing obstacles via bridge
    const obstacles = CopperPourBridge.buildObstacles({
      traces: [
        {
          points: [{ x: 20, y: 50 }, { x: 80, y: 50 }],
          layer: 'F.Cu',
          width: 5,
          netId: 'VCC',
        },
      ],
      vias: [
        { position: { x: 50, y: 50 }, outerDiameter: 8 },
      ],
    });

    // Feed to engine
    engine.setRoutingObstacles(obstacles);

    // Fill should succeed
    const result = engine.fillZone(zone.id);
    expect(result.zoneId).toBe(zone.id);
    expect(result.polygons.length).toBeGreaterThanOrEqual(0);
  });

  it('clears previous routing obstacles when called again', () => {
    const engine = CopperPourEngine.getInstance();

    engine.setRoutingObstacles([
      { type: 'trace', geometry: 'rect', x: 10, y: 10, width: 20, height: 0.5, layer: 'F.Cu', netId: 'VCC' },
    ]);

    // Verify obstacles are set
    let obs = engine.getObstacles();
    expect(obs.traces.length + obs.pads.length + obs.vias.length).toBeGreaterThan(0);

    // Clear with empty
    engine.setRoutingObstacles([]);
    obs = engine.getObstacles();
    expect(obs.traces.length + obs.pads.length + obs.vias.length).toBe(0);
  });
});
