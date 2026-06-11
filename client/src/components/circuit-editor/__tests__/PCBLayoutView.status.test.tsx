import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { PcbSurfaceStatusDock } from '@/components/circuit-editor/PCBLayoutView';
import { getPcbSurfaceSafetyGate, getPcbSurfaceStatus } from '@/lib/pcb/pcb-surface-status';
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
    pcbX: null,
    pcbY: null,
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

describe('PCBLayoutView surface status', () => {
  it('marks an empty PCB as reviewable, not fabrication-ready', () => {
    const status = getPcbSurfaceStatus({
      instances: [],
      nets: [],
      wires: [],
      boardWidth: 500,
      boardHeight: 400,
    });

    expect(status.trustKind).toBe('estimated');
    expect(status.trustLabel).toBe('PCB_EMPTY');
    expect(status.boardSizeLabel).toBe('50 x 40 mm');
    expect(status.trustSummary).toContain('Place parts');
  });

  it('prioritizes unverified generated footprint signals over placement progress', () => {
    const status = getPcbSurfaceStatus({
      instances: [
        makeInstance({
          id: 1,
          referenceDesignator: 'U1',
          pcbX: 10,
          pcbY: 20,
          properties: {
            generatedFrom: 'ai-chat',
            authoritativeWiringAllowed: false,
            verificationStatus: 'candidate',
          },
        }),
        makeInstance({
          id: 2,
          referenceDesignator: 'R1',
          pcbX: null,
          pcbY: null,
        }),
      ],
      nets: [makeNet()],
      wires: [],
      boardWidth: 500,
      boardHeight: 400,
    });

    expect(status.trustKind).toBe('unverified');
    expect(status.trustLabel).toBe('PCB_UNVERIFIED');
    expect(status.placedCount).toBe(1);
    expect(status.instanceCount).toBe(2);
    expect(status.unverifiedCount).toBe(1);
    expect(status.generatedCount).toBe(1);
    expect(status.routedCount).toBe(0);
    expect(status.totalNets).toBe(1);
    expect(status.provenanceFlagLabel).toBe('1 needs verification');
    expect(status.trustSummary).toContain('before fabrication outputs');
  });

  it('marks local placed and routed geometry as clear when no provenance flags are present', () => {
    const status = getPcbSurfaceStatus({
      instances: [
        makeInstance({ id: 1, referenceDesignator: 'U1', pcbX: 10, pcbY: 20 }),
        makeInstance({ id: 2, referenceDesignator: 'R1', pcbX: 40, pcbY: 20 }),
      ],
      nets: [makeNet()],
      wires: [makeWire()],
      boardWidth: 635,
      boardHeight: 420,
    });

    expect(status.trustKind).toBe('verified');
    expect(status.trustLabel).toBe('PCB_LOCAL');
    expect(status.placedCount).toBe(2);
    expect(status.unplacedCount).toBe(0);
    expect(status.routedCount).toBe(1);
    expect(status.totalNets).toBe(1);
    expect(status.boardSizeLabel).toBe('63.5 x 42 mm');
    expect(status.trustSummary).toContain('No unverified footprint provenance');
  });

  it('renders a collapsible PCB surface dock with DRC gate context', () => {
    const status = getPcbSurfaceStatus({
      instances: [
        makeInstance({
          id: 1,
          referenceDesignator: 'U1',
          pcbX: 10,
          pcbY: 20,
          properties: {
            generatedFrom: 'ai-chat',
            authoritativeWiringAllowed: false,
            verificationStatus: 'candidate',
          },
        }),
      ],
      nets: [makeNet()],
      wires: [],
      boardWidth: 500,
      boardHeight: 400,
    });
    const onToggle = vi.fn();
    const onRunDrc = vi.fn();

    render(
      <div className="relative h-[20rem] w-[40rem]">
        <PcbSurfaceStatusDock
          status={status}
          safetyGate={getPcbSurfaceSafetyGate(status)}
          collapsed={false}
          onToggle={onToggle}
          onRunDrc={onRunDrc}
        />
      </div>,
    );

    const dock = screen.getByTestId('pcb-surface-status');
    expect(dock.getAttribute('data-resizable')).toBe('true');
    expect(screen.getByTestId('pcb-surface-drc-gate').getAttribute('data-blocks-fabrication')).toBe('true');
    expect(screen.getByTestId('pcb-surface-drc-gate-label')).toHaveTextContent('FAB_BLOCKED');
    expect(screen.getByTestId('pcb-surface-provenance-flags')).toHaveTextContent('1 needs verification');

    fireEvent.click(screen.getByTestId('button-pcb-surface-run-drc'));
    expect(onRunDrc).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('button-toggle-pcb-surface-status'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
