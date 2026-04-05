import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BreadboardComponentOverlay } from '../BreadboardComponentRenderer';
import type { ComponentPart, CircuitInstanceRow } from '@shared/schema';

vi.mock('@/lib/contexts/simulation-context', () => ({
  useSimulation: () => ({
    componentStates: {},
    isLive: false,
  }),
}));

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: 1,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: 80,
    breadboardY: 60,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

describe('BreadboardComponentOverlay', () => {
  it('prefers exact breadboard artwork for board-like parts', () => {
    const part = {
      id: 1,
      projectId: 1,
      nodeId: null,
      meta: {
        title: 'Arduino Mega 2560 R3',
        family: 'mcu',
        tags: ['arduino', 'module'],
        mountingType: 'tht',
        properties: [],
        verificationStatus: 'candidate',
      },
      connectors: [],
      buses: [],
      views: {
        breadboard: {
          shapes: [
            {
              id: 'board',
              type: 'rect',
              x: 0,
              y: 0,
              width: 120,
              height: 40,
              rotation: 0,
              style: { fill: '#1f2937', stroke: '#93c5fd', strokeWidth: 1 },
            },
          ],
        },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
      constraints: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies ComponentPart;

    render(
      <svg>
        <BreadboardComponentOverlay
          instances={[makeInstance()]}
          parts={[part]}
          selectedId={1}
          onInstanceClick={() => {}}
        />
      </svg>,
    );

    expect(screen.getByTestId('bb-exact-view-1')).toBeDefined();
    expect(screen.getByTestId('bb-exact-status-1').textContent).toContain('Candidate exact');
  });

  it('keeps family renderers for non-board parts even if they have simple shapes', () => {
    const part = {
      id: 2,
      projectId: 1,
      nodeId: null,
      meta: {
        title: '10k resistor',
        family: 'resistor',
        type: 'resistor',
        tags: ['passive'],
        mountingType: 'tht',
        properties: [],
        verificationStatus: 'candidate',
      },
      connectors: [],
      buses: [],
      views: {
        breadboard: {
          shapes: [
            {
              id: 'body',
              type: 'rect',
              x: 0,
              y: 0,
              width: 30,
              height: 8,
              rotation: 0,
              style: { fill: '#d4a373' },
            },
          ],
        },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
      constraints: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies ComponentPart;

    render(
      <svg>
        <BreadboardComponentOverlay
          instances={[makeInstance({ id: 2, partId: 2, referenceDesignator: 'R1', properties: { value: 10000 } })]}
          parts={[part]}
          selectedId={2}
          onInstanceClick={() => {}}
        />
      </svg>,
    );

    expect(screen.queryByTestId('bb-exact-view-2')).toBeNull();
    expect(screen.getByTestId('bb-value-label-2').textContent).toContain('10k');
  });
});
