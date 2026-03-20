import { describe, it, expect } from 'vitest';

import {
  extractTraceGeometries,
  traceGeometryToPdnInput,
  traceGeometryToSiInput,
} from '../pcb-geometry-bridge';
import type {
  TraceGeometry,
  CircuitWireData,
  CircuitNetData,
  PdnTraceInput,
  SiTraceInput,
} from '../pcb-geometry-bridge';
import type { StackupLayer } from '@/lib/board-stackup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWire(overrides: Partial<CircuitWireData> = {}): CircuitWireData {
  return {
    id: 1,
    netId: 1,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    width: 0.25,
    layer: 'F.Cu',
    ...overrides,
  };
}

function makeNet(overrides: Partial<CircuitNetData> = {}): CircuitNetData {
  return {
    id: 1,
    name: 'VCC',
    ...overrides,
  };
}

function makeStackupLayer(overrides: Partial<StackupLayer> = {}): StackupLayer {
  return {
    id: 'layer-1',
    name: 'F.Cu',
    type: 'signal',
    material: 'FR4',
    thickness: 1.4,
    copperWeight: '1oz',
    dielectricConstant: 4.4,
    lossTangent: 0.02,
    order: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// extractTraceGeometries
// ---------------------------------------------------------------------------

describe('extractTraceGeometries', () => {
  it('computes total length from a single-segment wire', () => {
    const wires: CircuitWireData[] = [makeWire()];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result).toHaveLength(1);
    expect(result[0].totalLength).toBeCloseTo(10, 5);
    expect(result[0].netName).toBe('VCC');
    expect(result[0].netId).toBe(1);
  });

  it('computes total length from a multi-segment wire', () => {
    const wires: CircuitWireData[] = [
      makeWire({
        points: [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
          { x: 3, y: 4 },
        ],
      }),
    ];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    // 3 + 4 = 7
    expect(result[0].totalLength).toBeCloseTo(7, 5);
    expect(result[0].segmentCount).toBe(2);
  });

  it('aggregates multiple wires on the same net', () => {
    const wires: CircuitWireData[] = [
      makeWire({ id: 1, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], width: 0.2 }),
      makeWire({ id: 2, points: [{ x: 5, y: 0 }, { x: 5, y: 3 }], width: 0.3 }),
    ];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result).toHaveLength(1);
    expect(result[0].totalLength).toBeCloseTo(8, 5);
    expect(result[0].avgWidth).toBeCloseTo(0.25, 5);
    expect(result[0].minWidth).toBeCloseTo(0.2, 5);
    expect(result[0].segmentCount).toBe(2);
  });

  it('separates traces by net', () => {
    const wires: CircuitWireData[] = [
      makeWire({ id: 1, netId: 1 }),
      makeWire({ id: 2, netId: 2 }),
    ];
    const nets: CircuitNetData[] = [
      makeNet({ id: 1, name: 'VCC' }),
      makeNet({ id: 2, name: 'GND' }),
    ];
    const result = extractTraceGeometries(wires, nets);

    expect(result).toHaveLength(2);
    const names = result.map((t) => t.netName).sort();
    expect(names).toEqual(['GND', 'VCC']);
  });

  it('handles empty wires', () => {
    const result = extractTraceGeometries([], [makeNet()]);
    expect(result).toHaveLength(0);
  });

  it('handles empty nets (uses fallback name)', () => {
    const wires: CircuitWireData[] = [makeWire({ netId: 99 })];
    const result = extractTraceGeometries(wires, []);

    expect(result).toHaveLength(1);
    expect(result[0].netName).toBe('net-99');
  });

  it('handles wire with single point (no segments)', () => {
    const wires: CircuitWireData[] = [makeWire({ points: [{ x: 5, y: 5 }] })];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result).toHaveLength(1);
    expect(result[0].totalLength).toBe(0);
    expect(result[0].segmentCount).toBe(0);
  });

  it('handles wire with empty points array', () => {
    const wires: CircuitWireData[] = [makeWire({ points: [] })];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result).toHaveLength(1);
    expect(result[0].totalLength).toBe(0);
    expect(result[0].segmentCount).toBe(0);
  });

  it('computes diagonal segment length correctly', () => {
    const wires: CircuitWireData[] = [
      makeWire({ points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] }),
    ];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result[0].totalLength).toBeCloseTo(5, 5); // 3-4-5 triangle
  });

  it('uses layer from the wire', () => {
    const wires: CircuitWireData[] = [makeWire({ layer: 'B.Cu' })];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result[0].layer).toBe('B.Cu');
  });

  it('handles null layer by defaulting to F.Cu', () => {
    const wires: CircuitWireData[] = [makeWire({ layer: null })];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result[0].layer).toBe('F.Cu');
  });

  it('counts vias from wires on different layers in the same net', () => {
    const wires: CircuitWireData[] = [
      makeWire({ id: 1, netId: 1, layer: 'F.Cu' }),
      makeWire({ id: 2, netId: 1, layer: 'B.Cu' }),
    ];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result).toHaveLength(1);
    // 2 distinct layers means at least 1 via transition
    expect(result[0].viaCount).toBe(1);
  });

  it('counts multiple vias for multiple layer transitions', () => {
    const wires: CircuitWireData[] = [
      makeWire({ id: 1, netId: 1, layer: 'F.Cu' }),
      makeWire({ id: 2, netId: 1, layer: 'In1.Cu' }),
      makeWire({ id: 3, netId: 1, layer: 'B.Cu' }),
    ];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    // 3 distinct layers → 2 via transitions
    expect(result[0].viaCount).toBe(2);
  });

  it('does not count vias for single-layer nets', () => {
    const wires: CircuitWireData[] = [
      makeWire({ id: 1, netId: 1, layer: 'F.Cu' }),
      makeWire({ id: 2, netId: 1, layer: 'F.Cu' }),
    ];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result[0].viaCount).toBe(0);
  });

  it('handles many wires on one net', () => {
    const wires: CircuitWireData[] = [];
    for (let i = 0; i < 100; i++) {
      wires.push(makeWire({
        id: i,
        netId: 1,
        points: [{ x: i, y: 0 }, { x: i + 1, y: 0 }],
        width: 0.1 + i * 0.01,
      }));
    }
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result).toHaveLength(1);
    expect(result[0].totalLength).toBeCloseTo(100, 5);
    expect(result[0].segmentCount).toBe(100);
    expect(result[0].minWidth).toBeCloseTo(0.1, 5);
  });

  it('handles zero-width wire gracefully', () => {
    const wires: CircuitWireData[] = [makeWire({ width: 0 })];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    expect(result).toHaveLength(1);
    expect(result[0].avgWidth).toBe(0);
    expect(result[0].minWidth).toBe(0);
  });

  it('uses first encountered layer as primary', () => {
    const wires: CircuitWireData[] = [
      makeWire({ id: 1, netId: 1, layer: 'In1.Cu', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }),
      makeWire({ id: 2, netId: 1, layer: 'F.Cu', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }] }),
    ];
    const nets: CircuitNetData[] = [makeNet()];
    const result = extractTraceGeometries(wires, nets);

    // Primary layer should be the one with most total length
    expect(result[0].layer).toBe('In1.Cu');
  });
});

// ---------------------------------------------------------------------------
// traceGeometryToPdnInput
// ---------------------------------------------------------------------------

describe('traceGeometryToPdnInput', () => {
  const stackup: StackupLayer[] = [
    makeStackupLayer({ id: 'l1', name: 'F.Cu', type: 'signal', order: 0, thickness: 1.4 }),
    makeStackupLayer({ id: 'l2', name: 'GND', type: 'ground', order: 1, thickness: 4.0 }),
    makeStackupLayer({ id: 'l3', name: 'PWR', type: 'power', order: 2, thickness: 4.0 }),
    makeStackupLayer({ id: 'l4', name: 'B.Cu', type: 'signal', order: 3, thickness: 1.4 }),
  ];

  it('converts trace geometry to PDN input', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1,
        netName: 'VCC',
        totalLength: 50,
        avgWidth: 0.25,
        minWidth: 0.2,
        layer: 'F.Cu',
        segmentCount: 5,
        viaCount: 2,
      },
    ];
    const result = traceGeometryToPdnInput(traces, stackup);

    expect(result.powerNet).toBeDefined();
    expect(result.vias).toHaveLength(2);
    expect(result.stackup).toEqual(stackup);
  });

  it('creates vias from viaCount', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'VCC', totalLength: 30, avgWidth: 0.3,
        minWidth: 0.2, layer: 'F.Cu', segmentCount: 3, viaCount: 3,
      },
    ];
    const result = traceGeometryToPdnInput(traces, stackup);

    expect(result.vias).toHaveLength(3);
    for (const via of result.vias) {
      expect(via.diameter).toBeGreaterThan(0);
      expect(via.inductance).toBeGreaterThanOrEqual(0);
      expect(via.resistance).toBeGreaterThanOrEqual(0);
    }
  });

  it('computes plane area from trace length and width', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'VCC', totalLength: 100, avgWidth: 0.5,
        minWidth: 0.3, layer: 'F.Cu', segmentCount: 10, viaCount: 0,
      },
    ];
    const result = traceGeometryToPdnInput(traces, stackup);

    expect(result.planeArea).toBeGreaterThan(0);
  });

  it('handles empty traces', () => {
    const result = traceGeometryToPdnInput([], stackup);

    expect(result.powerNet).toBeDefined();
    expect(result.vias).toHaveLength(0);
  });

  it('handles empty stackup', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'VCC', totalLength: 50, avgWidth: 0.25,
        minWidth: 0.2, layer: 'F.Cu', segmentCount: 5, viaCount: 1,
      },
    ];
    const result = traceGeometryToPdnInput(traces, []);

    expect(result.stackup).toHaveLength(0);
  });

  it('returns PdnTraceInput shape', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'VCC', totalLength: 20, avgWidth: 0.3,
        minWidth: 0.2, layer: 'F.Cu', segmentCount: 2, viaCount: 0,
      },
    ];
    const result: PdnTraceInput = traceGeometryToPdnInput(traces, stackup);

    expect(result).toHaveProperty('powerNet');
    expect(result).toHaveProperty('vias');
    expect(result).toHaveProperty('planeArea');
    expect(result).toHaveProperty('stackup');
  });
});

// ---------------------------------------------------------------------------
// traceGeometryToSiInput
// ---------------------------------------------------------------------------

describe('traceGeometryToSiInput', () => {
  const stackup: StackupLayer[] = [
    makeStackupLayer({ id: 'l1', name: 'F.Cu', type: 'signal', order: 0 }),
    makeStackupLayer({ id: 'l2', name: 'GND', type: 'ground', order: 1 }),
  ];

  it('converts trace geometry to SI TraceInfo array', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'CLK', totalLength: 50, avgWidth: 0.15,
        minWidth: 0.12, layer: 'F.Cu', segmentCount: 5, viaCount: 0,
      },
    ];
    const result = traceGeometryToSiInput(traces, stackup);

    expect(result.traces).toHaveLength(1);
    expect(result.traces[0].name).toBe('CLK');
    expect(result.traces[0].length).toBe(50);
    expect(result.traces[0].width).toBe(0.15);
  });

  it('sets default targetZ0 and netClass', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'DATA', totalLength: 30, avgWidth: 0.2,
        minWidth: 0.15, layer: 'F.Cu', segmentCount: 3, viaCount: 0,
      },
    ];
    const result = traceGeometryToSiInput(traces, stackup);

    expect(result.traces[0].targetZ0).toBe(50);
    expect(result.traces[0].netClass).toBe('Default');
  });

  it('uses matching stackup layer for layer info', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'SIG', totalLength: 20, avgWidth: 0.15,
        minWidth: 0.12, layer: 'F.Cu', segmentCount: 2, viaCount: 0,
      },
    ];
    const result = traceGeometryToSiInput(traces, stackup);

    expect(result.traces[0].layer.er).toBe(4.4);
    expect(result.traces[0].layer.tanD).toBe(0.02);
  });

  it('handles multiple traces', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'CLK', totalLength: 50, avgWidth: 0.15,
        minWidth: 0.12, layer: 'F.Cu', segmentCount: 5, viaCount: 0,
      },
      {
        netId: 2, netName: 'DATA', totalLength: 30, avgWidth: 0.2,
        minWidth: 0.18, layer: 'F.Cu', segmentCount: 3, viaCount: 0,
      },
    ];
    const result = traceGeometryToSiInput(traces, stackup);

    expect(result.traces).toHaveLength(2);
    expect(result.traces[0].name).toBe('CLK');
    expect(result.traces[1].name).toBe('DATA');
  });

  it('handles empty traces', () => {
    const result = traceGeometryToSiInput([], stackup);
    expect(result.traces).toHaveLength(0);
  });

  it('computes spacing between traces', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'A', totalLength: 50, avgWidth: 0.15,
        minWidth: 0.12, layer: 'F.Cu', segmentCount: 5, viaCount: 0,
      },
      {
        netId: 2, netName: 'B', totalLength: 30, avgWidth: 0.15,
        minWidth: 0.12, layer: 'F.Cu', segmentCount: 3, viaCount: 0,
      },
    ];
    const result = traceGeometryToSiInput(traces, stackup);

    // Default spacing should be reasonable
    expect(result.traces[0].spacing).toBeGreaterThan(0);
    expect(result.traces[1].spacing).toBeGreaterThan(0);
  });

  it('returns SiTraceInput shape', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'NET', totalLength: 10, avgWidth: 0.2,
        minWidth: 0.2, layer: 'F.Cu', segmentCount: 1, viaCount: 0,
      },
    ];
    const result: SiTraceInput = traceGeometryToSiInput(traces, stackup);

    expect(result).toHaveProperty('traces');
    expect(result.traces[0]).toHaveProperty('layer');
    expect(result.traces[0]).toHaveProperty('targetZ0');
    expect(result.traces[0]).toHaveProperty('netClass');
    expect(result.traces[0]).toHaveProperty('spacing');
  });

  it('falls back to default stackup layer when no match', () => {
    const traces: TraceGeometry[] = [
      {
        netId: 1, netName: 'SIG', totalLength: 20, avgWidth: 0.15,
        minWidth: 0.12, layer: 'In3.Cu', segmentCount: 2, viaCount: 0,
      },
    ];
    const result = traceGeometryToSiInput(traces, stackup);

    // Should still produce valid output with a fallback layer
    expect(result.traces).toHaveLength(1);
    expect(result.traces[0].layer.er).toBeGreaterThan(0);
    expect(result.traces[0].layer.height).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: extract → convert → PDN/SI
// ---------------------------------------------------------------------------

describe('integration: extract → convert', () => {
  const stackup: StackupLayer[] = [
    makeStackupLayer({ id: 'l1', name: 'F.Cu', type: 'signal', order: 0 }),
    makeStackupLayer({ id: 'l2', name: 'GND', type: 'ground', order: 1 }),
  ];

  it('wires → trace geometries → PDN input', () => {
    const wires: CircuitWireData[] = [
      makeWire({ id: 1, netId: 1, points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], width: 0.5 }),
      makeWire({ id: 2, netId: 1, points: [{ x: 30, y: 0 }, { x: 30, y: 20 }], width: 0.4 }),
    ];
    const nets: CircuitNetData[] = [makeNet({ id: 1, name: 'PWR' })];

    const traces = extractTraceGeometries(wires, nets);
    const pdnInput = traceGeometryToPdnInput(traces, stackup);

    expect(pdnInput.powerNet.name).toBe('PWR');
    expect(pdnInput.planeArea).toBeGreaterThan(0);
  });

  it('wires → trace geometries → SI input', () => {
    const wires: CircuitWireData[] = [
      makeWire({ id: 1, netId: 1, points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], width: 0.15 }),
      makeWire({ id: 2, netId: 2, points: [{ x: 0, y: 1 }, { x: 50, y: 1 }], width: 0.15 }),
    ];
    const nets: CircuitNetData[] = [
      makeNet({ id: 1, name: 'CLK_P' }),
      makeNet({ id: 2, name: 'CLK_N' }),
    ];

    const traces = extractTraceGeometries(wires, nets);
    const siInput = traceGeometryToSiInput(traces, stackup);

    expect(siInput.traces).toHaveLength(2);
    expect(siInput.traces[0].length).toBeCloseTo(50, 5);
    expect(siInput.traces[1].length).toBeCloseTo(50, 5);
  });

  it('handles mixed layers with via count', () => {
    const wires: CircuitWireData[] = [
      makeWire({ id: 1, netId: 1, layer: 'F.Cu', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] }),
      makeWire({ id: 2, netId: 1, layer: 'B.Cu', points: [{ x: 20, y: 0 }, { x: 40, y: 0 }] }),
    ];
    const nets: CircuitNetData[] = [makeNet({ id: 1, name: 'SIG' })];

    const traces = extractTraceGeometries(wires, nets);
    expect(traces[0].viaCount).toBe(1);

    const pdnInput = traceGeometryToPdnInput(traces, stackup);
    expect(pdnInput.vias).toHaveLength(1);
  });
});
