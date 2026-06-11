import { describe, expect, it } from 'vitest';

import {
  getPcbSurfaceSafetyGate,
  getPcbSurfaceStatus,
  PCB_RUN_DRC_EVENT,
  type PcbRunDrcEventDetail,
} from '../pcb-surface-status';
import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow } from '@shared/schema';

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    benchX: null,
    benchY: null,
    pcbX: 10,
    pcbY: 20,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: {},
    createdAt: new Date('2026-05-25T00:00:00.000Z'),
    ...overrides,
  } as CircuitInstanceRow;
}

function makeNet(overrides: Partial<CircuitNetRow> = {}): CircuitNetRow {
  return {
    id: 1,
    circuitId: 1,
    name: 'GND',
    color: '#ffffff',
    properties: {},
    createdAt: new Date('2026-05-25T00:00:00.000Z'),
    ...overrides,
  } as CircuitNetRow;
}

function makeWire(overrides: Partial<CircuitWireRow> = {}): CircuitWireRow {
  return {
    id: 1,
    circuitId: 1,
    netId: 1,
    fromInstanceId: 1,
    fromPinId: '1',
    toInstanceId: 2,
    toPinId: '1',
    view: 'pcb',
    points: [],
    properties: {},
    createdAt: new Date('2026-05-25T00:00:00.000Z'),
    ...overrides,
  } as CircuitWireRow;
}

function getStatus({
  instances = [makeInstance({ id: 1 }), makeInstance({ id: 2, referenceDesignator: 'R1' })],
  nets = [makeNet()],
  wires = [makeWire()],
}: {
  instances?: CircuitInstanceRow[];
  nets?: CircuitNetRow[];
  wires?: CircuitWireRow[];
} = {}) {
  return getPcbSurfaceStatus({
    instances,
    nets,
    wires,
    boardWidth: 500,
    boardHeight: 400,
  });
}

describe('pcb-surface-status', () => {
  it('blocks fabrication while keeping DRC runnable when the PCB has no footprints', () => {
    const gate = getPcbSurfaceSafetyGate(getStatus({ instances: [], nets: [], wires: [] }));

    expect(gate.severity).toBe('blocked');
    expect(gate.label).toBe('FAB_BLOCKED');
    expect(gate.blocksFabrication).toBe(true);
    expect(gate.canRunDrc).toBe(true);
    expect(gate.reasons).toContain('No PCB footprints placed');
  });

  it('blocks fabrication for unverified generated footprint signals', () => {
    const gate = getPcbSurfaceSafetyGate(getStatus({
      instances: [
        makeInstance({
          properties: {
            generatedFrom: 'ai-chat',
            authoritativeWiringAllowed: false,
            verificationStatus: 'candidate',
          },
        }),
      ],
    }));

    expect(gate.severity).toBe('blocked');
    expect(gate.blocksFabrication).toBe(true);
    expect(gate.reasons.join(' ')).toContain('needs verification');
  });

  it('blocks fabrication when placement or routing is incomplete', () => {
    const gate = getPcbSurfaceSafetyGate(getStatus({
      instances: [
        makeInstance({ id: 1 }),
        makeInstance({ id: 2, pcbX: null, pcbY: null }),
      ],
      nets: [makeNet({ id: 1 }), makeNet({ id: 2, name: 'VCC' })],
      wires: [makeWire({ netId: 1 })],
    }));

    expect(gate.severity).toBe('blocked');
    expect(gate.reasons).toContain('1 component unplaced');
    expect(gate.reasons).toContain('1 net unrouted');
  });

  it('warns for generated footprints that are not marked unverified', () => {
    const gate = getPcbSurfaceSafetyGate(getStatus({
      instances: [
        makeInstance({
          properties: {
            generatedFrom: 'exact-part-workflow',
          },
        }),
      ],
    }));

    expect(gate.severity).toBe('warning');
    expect(gate.label).toBe('FAB_REVIEW');
    expect(gate.blocksFabrication).toBe(false);
    expect(gate.reasons.join(' ')).toContain('generated footprint');
  });

  it('clears the gate for placed, routed, locally trusted PCB geometry', () => {
    const gate = getPcbSurfaceSafetyGate(getStatus());

    expect(gate.severity).toBe('clear');
    expect(gate.label).toBe('FAB_CLEAR');
    expect(gate.blocksFabrication).toBe(false);
  });

  it('keeps the DRC event detail typed around the PCB safety gate', () => {
    const status = getStatus();
    const detail: PcbRunDrcEventDetail = {
      source: 'pcb-layout',
      surfaceStatus: status,
      safetyGate: getPcbSurfaceSafetyGate(status),
    };

    expect(PCB_RUN_DRC_EVENT).toBe('protopulse:run-drc');
    expect(detail.safetyGate.canRunDrc).toBe(true);
    expect(detail.surfaceStatus.trustLabel).toBe('PCB_LOCAL');
  });
});
