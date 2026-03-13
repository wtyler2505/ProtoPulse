import { describe, it, expect } from 'vitest';
import { calculateRoutingStatus } from '../routing-status';
import type { CircuitNetRow, CircuitWireRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeNet(overrides: Partial<CircuitNetRow> & { id: number; name: string }): CircuitNetRow {
  return {
    circuitId: 1,
    netType: 'signal',
    voltage: null,
    busWidth: null,
    segments: [],
    labels: [],
    style: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitNetRow;
}

function makeWire(overrides: Partial<CircuitWireRow> & { id: number; netId: number }): CircuitWireRow {
  return {
    circuitId: 1,
    view: 'pcb',
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    layer: 'front',
    width: 1.0,
    color: null,
    wireType: 'wire',
    createdAt: new Date(),
    ...overrides,
  } as CircuitWireRow;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateRoutingStatus', () => {
  it('returns 100% when there are no nets', () => {
    const result = calculateRoutingStatus([], []);
    expect(result.total).toBe(0);
    expect(result.routed).toBe(0);
    expect(result.unrouted).toBe(0);
    expect(result.percentComplete).toBe(100);
    expect(result.perNet.size).toBe(0);
  });

  it('returns 0% when there are nets but no wires', () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC' }),
      makeNet({ id: 2, name: 'GND' }),
      makeNet({ id: 3, name: 'SIG1' }),
    ];
    const result = calculateRoutingStatus(nets, []);
    expect(result.total).toBe(3);
    expect(result.routed).toBe(0);
    expect(result.unrouted).toBe(3);
    expect(result.percentComplete).toBe(0);
  });

  it('returns 100% when all nets have PCB wires', () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC' }),
      makeNet({ id: 2, name: 'GND' }),
    ];
    const wires = [
      makeWire({ id: 100, netId: 1, view: 'pcb' }),
      makeWire({ id: 101, netId: 2, view: 'pcb' }),
    ];
    const result = calculateRoutingStatus(nets, wires);
    expect(result.total).toBe(2);
    expect(result.routed).toBe(2);
    expect(result.unrouted).toBe(0);
    expect(result.percentComplete).toBe(100);
  });

  it('calculates partial routing correctly', () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC' }),
      makeNet({ id: 2, name: 'GND' }),
      makeNet({ id: 3, name: 'SIG1' }),
      makeNet({ id: 4, name: 'SIG2' }),
    ];
    const wires = [
      makeWire({ id: 100, netId: 1, view: 'pcb' }),
      makeWire({ id: 101, netId: 3, view: 'pcb' }),
    ];
    const result = calculateRoutingStatus(nets, wires);
    expect(result.total).toBe(4);
    expect(result.routed).toBe(2);
    expect(result.unrouted).toBe(2);
    expect(result.percentComplete).toBe(50);
  });

  it('ignores non-PCB wires (schematic view)', () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC' }),
      makeNet({ id: 2, name: 'GND' }),
    ];
    const wires = [
      makeWire({ id: 100, netId: 1, view: 'schematic' }),
      makeWire({ id: 101, netId: 2, view: 'schematic' }),
    ];
    const result = calculateRoutingStatus(nets, wires);
    expect(result.total).toBe(2);
    expect(result.routed).toBe(0);
    expect(result.unrouted).toBe(2);
    expect(result.percentComplete).toBe(0);
  });

  it('counts a net as routed even with multiple wires on same net', () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC' }),
    ];
    const wires = [
      makeWire({ id: 100, netId: 1, view: 'pcb' }),
      makeWire({ id: 101, netId: 1, view: 'pcb' }),
      makeWire({ id: 102, netId: 1, view: 'pcb' }),
    ];
    const result = calculateRoutingStatus(nets, wires);
    expect(result.total).toBe(1);
    expect(result.routed).toBe(1);
    expect(result.unrouted).toBe(0);
    expect(result.percentComplete).toBe(100);
  });

  it('provides per-net routing info', () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC' }),
      makeNet({ id: 2, name: 'GND' }),
      makeNet({ id: 3, name: 'SIG1' }),
    ];
    const wires = [
      makeWire({ id: 100, netId: 1, view: 'pcb' }),
    ];
    const result = calculateRoutingStatus(nets, wires);

    const vccInfo = result.perNet.get(1);
    expect(vccInfo).toBeDefined();
    expect(vccInfo?.netName).toBe('VCC');
    expect(vccInfo?.routed).toBe(true);

    const gndInfo = result.perNet.get(2);
    expect(gndInfo).toBeDefined();
    expect(gndInfo?.netName).toBe('GND');
    expect(gndInfo?.routed).toBe(false);

    const sig1Info = result.perNet.get(3);
    expect(sig1Info).toBeDefined();
    expect(sig1Info?.netName).toBe('SIG1');
    expect(sig1Info?.routed).toBe(false);
  });

  it('rounds percentage correctly', () => {
    const nets = [
      makeNet({ id: 1, name: 'A' }),
      makeNet({ id: 2, name: 'B' }),
      makeNet({ id: 3, name: 'C' }),
    ];
    const wires = [
      makeWire({ id: 100, netId: 1, view: 'pcb' }),
    ];
    const result = calculateRoutingStatus(nets, wires);
    // 1/3 = 33.33... -> rounds to 33
    expect(result.percentComplete).toBe(33);
  });

  it('handles mixed PCB and schematic wires correctly', () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC' }),
      makeNet({ id: 2, name: 'GND' }),
    ];
    const wires = [
      makeWire({ id: 100, netId: 1, view: 'pcb' }),
      makeWire({ id: 101, netId: 1, view: 'schematic' }),
      makeWire({ id: 102, netId: 2, view: 'schematic' }),
    ];
    const result = calculateRoutingStatus(nets, wires);
    expect(result.routed).toBe(1);
    expect(result.unrouted).toBe(1);
    expect(result.percentComplete).toBe(50);
  });
});
