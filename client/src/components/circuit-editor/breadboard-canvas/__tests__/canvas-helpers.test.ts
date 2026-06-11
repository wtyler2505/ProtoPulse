/**
 * Unit tests for breadboard-canvas/canvas-helpers.
 *
 * Covers:
 *   - buildAutoPlacementTemplate: DIP vs discrete row-span math
 *   - findAutoPlacement: collision-aware search
 *   - isDipLikeType
 *   - buildPlacementForDrop: row-span + startCol for DIP vs discrete
 *   - getDropTypeFromPart: meta.type > meta.family > fallback
 */

import { describe, it, expect } from 'vitest';
import {
  buildAutoPlacementTemplate,
  buildPlacementForDrop,
  buildProjectDropInstanceDraft,
  buildStarterDropInstanceDraft,
  findAutoPlacement,
  getCanvasBenchInstances,
  getDropTypeFromPart,
  hasBreadboardDropPayloadType,
  isDipLikeType,
  readProjectPartDropData,
  readStarterDropData,
  resolveBoardDropPlacement,
  WIRE_COLORS,
} from '../canvas-helpers';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { ComponentPlacement } from '@/lib/circuit-editor/breadboard-model';

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    referenceDesignator: 'R1',
    properties: null,
    breadboardX: null,
    breadboardY: null,
    benchX: null,
    benchY: null,
    rotation: 0,
    mirrored: false,
    ...overrides,
  } as CircuitInstanceRow;
}

function makePart(overrides: Partial<ComponentPart> = {}): ComponentPart {
  return {
    id: 100,
    projectId: 1,
    name: 'Test',
    type: 'component',
    meta: null,
    connectors: [],
    ...overrides,
  } as ComponentPart;
}

const dragMimeTypes = {
  projectPart: 'application/x-protopulse-part',
  starterType: 'application/x-protopulse-node-type',
  starterLabel: 'application/x-protopulse-node-label',
} as const;

function makeDataTransfer(values: Record<string, string>) {
  return {
    getData: (type: string) => values[type] ?? '',
  };
}

describe('isDipLikeType', () => {
  it('accepts ic / mcu / microcontroller (case-insensitive)', () => {
    expect(isDipLikeType('ic')).toBe(true);
    expect(isDipLikeType('IC')).toBe(true);
    expect(isDipLikeType('mcu')).toBe(true);
    expect(isDipLikeType('Microcontroller')).toBe(true);
  });

  it('rejects discrete types', () => {
    expect(isDipLikeType('resistor')).toBe(false);
    expect(isDipLikeType('led')).toBe(false);
    expect(isDipLikeType('capacitor')).toBe(false);
    expect(isDipLikeType('')).toBe(false);
  });
});

describe('drag payload parsing', () => {
  it('detects project and starter drag payload types', () => {
    expect(hasBreadboardDropPayloadType({
      includes: (type: string) => type === dragMimeTypes.projectPart,
    }, dragMimeTypes)).toBe(true);

    expect(hasBreadboardDropPayloadType({
      includes: (type: string) => type === dragMimeTypes.starterType,
    }, dragMimeTypes)).toBe(true);

    expect(hasBreadboardDropPayloadType({
      includes: () => false,
    }, dragMimeTypes)).toBe(false);
  });

  it('reads valid project-part payloads', () => {
    const dataTransfer = makeDataTransfer({
      [dragMimeTypes.projectPart]: JSON.stringify({ partId: 42 }),
    });

    expect(readProjectPartDropData(dataTransfer, dragMimeTypes.projectPart)).toEqual({ partId: 42 });
  });

  it('rejects missing, invalid JSON, and invalid project-part payloads', () => {
    expect(readProjectPartDropData(makeDataTransfer({}), dragMimeTypes.projectPart)).toBeNull();
    expect(readProjectPartDropData(makeDataTransfer({
      [dragMimeTypes.projectPart]: '{nope',
    }), dragMimeTypes.projectPart)).toBeNull();
    expect(readProjectPartDropData(makeDataTransfer({
      [dragMimeTypes.projectPart]: JSON.stringify({ partId: '42' }),
    }), dragMimeTypes.projectPart)).toBeNull();
  });

  it('reads starter node payloads', () => {
    const dataTransfer = makeDataTransfer({
      [dragMimeTypes.starterType]: 'resistor',
      [dragMimeTypes.starterLabel]: 'Resistor',
    });

    expect(readStarterDropData(dataTransfer, dragMimeTypes)).toEqual({
      nodeType: 'resistor',
      label: 'Resistor',
    });
  });

  it('rejects starter payloads without a node type', () => {
    expect(readStarterDropData(makeDataTransfer({
      [dragMimeTypes.starterLabel]: 'Resistor',
    }), dragMimeTypes)).toBeNull();
  });
});

describe('getCanvasBenchInstances', () => {
  it('returns only instances with bench placement', () => {
    const bench = makeInstance({ id: 1, benchX: 10, benchY: 20 });
    const board = makeInstance({ id: 2, breadboardX: 40, breadboardY: 60 });
    const staged = makeInstance({ id: 3 });
    const conflicting = makeInstance({
      id: 4,
      benchX: 70,
      benchY: 80,
      breadboardX: 90,
      breadboardY: 100,
    });

    expect(getCanvasBenchInstances([bench, board, staged, conflicting]).map((instance) => instance.id))
      .toEqual([1]);
  });

  it('handles missing instance lists', () => {
    expect(getCanvasBenchInstances(undefined)).toEqual([]);
    expect(getCanvasBenchInstances(null)).toEqual([]);
  });
});

describe('buildAutoPlacementTemplate', () => {
  it('treats U-prefixed refDes as DIP-like', () => {
    const inst = makeInstance({ referenceDesignator: 'U1' });
    const tpl = buildAutoPlacementTemplate(inst);
    expect(tpl.crossesChannel).toBe(true);
    expect(tpl.startCol).toBe('e');
    expect(tpl.rowSpan).toBeGreaterThanOrEqual(2);
  });

  it('treats meta.type "ic" as DIP-like', () => {
    const inst = makeInstance({ referenceDesignator: 'X1' });
    const part = makePart({ meta: { type: 'ic' }, connectors: new Array(8).fill({}) });
    const tpl = buildAutoPlacementTemplate(inst, part);
    expect(tpl.crossesChannel).toBe(true);
    expect(tpl.startCol).toBe('e');
    expect(tpl.rowSpan).toBe(Math.ceil(8 / 2));
  });

  it('falls back to properties.type when meta is missing', () => {
    const inst = makeInstance({
      referenceDesignator: 'X2',
      properties: { type: 'mcu' },
    });
    const part = makePart({ connectors: new Array(6).fill({}) });
    const tpl = buildAutoPlacementTemplate(inst, part);
    expect(tpl.crossesChannel).toBe(true);
  });

  it('uses discrete layout for a resistor-like instance', () => {
    const inst = makeInstance({ referenceDesignator: 'R2' });
    const part = makePart({ meta: { type: 'resistor' }, connectors: [{}, {}] });
    const tpl = buildAutoPlacementTemplate(inst, part);
    expect(tpl.crossesChannel).toBe(false);
    expect(tpl.startCol).toBe('a');
    expect(tpl.rowSpan).toBe(1);
  });

  it('sets refDes / startRow to the instance / 1', () => {
    const inst = makeInstance({ referenceDesignator: 'R99' });
    const tpl = buildAutoPlacementTemplate(inst);
    expect(tpl.refDes).toBe('R99');
    expect(tpl.startRow).toBe(1);
  });
});

describe('findAutoPlacement', () => {
  const template: ComponentPlacement = {
    refDes: 'R1',
    startCol: 'a',
    startRow: 1,
    rowSpan: 1,
    crossesChannel: false,
  };

  it('returns template at startRow=1 when board is empty', () => {
    const placement = findAutoPlacement(template, []);
    expect(placement).not.toBeNull();
    expect(placement?.startRow).toBe(1);
  });

  it('advances to a free row when startRow=1 is taken', () => {
    const existing: ComponentPlacement[] = [
      { refDes: 'R0', startCol: 'a', startRow: 1, rowSpan: 1, crossesChannel: false },
    ];
    const placement = findAutoPlacement(template, existing);
    expect(placement).not.toBeNull();
    expect(placement?.startRow).toBeGreaterThan(1);
  });
});

describe('buildPlacementForDrop', () => {
  it('snaps a DIP-like drop to column e and widens row-span', () => {
    const placement = buildPlacementForDrop(
      { type: 'terminal', col: 'b', row: 5 },
      'ic',
      8,
    );
    expect(placement.startCol).toBe('e');
    expect(placement.crossesChannel).toBe(true);
    expect(placement.rowSpan).toBe(Math.ceil(8 / 2));
  });

  it('keeps discrete parts in the originating column', () => {
    const placement = buildPlacementForDrop(
      { type: 'terminal', col: 'c', row: 7 },
      'resistor',
      2,
    );
    expect(placement.startCol).toBe('c');
    expect(placement.crossesChannel).toBe(false);
    expect(placement.rowSpan).toBe(1);
  });

  it('clamps startRow to keep the placement on-board', () => {
    // Request a drop near the bottom of the 63-row board.
    const placement = buildPlacementForDrop(
      { type: 'terminal', col: 'a', row: 63 },
      'ic',
      8,
    );
    // startRow + rowSpan - 1 must not exceed BB.ROWS (63).
    expect(placement.startRow + placement.rowSpan - 1).toBeLessThanOrEqual(63);
    // And the clamp actually had to kick in — startRow must be < requested row.
    expect(placement.startRow).toBeLessThan(63);
  });
});

describe('resolveBoardDropPlacement', () => {
  it('returns placement and snapped pixel for a valid terminal drop', () => {
    const result = resolveBoardDropPlacement({
      coord: { type: 'terminal', col: 'b', row: 5 },
      type: 'resistor',
      pinCount: 2,
      existingPlacements: [],
    });

    expect(result).not.toBeNull();
    expect(result?.placement).toMatchObject({
      startCol: 'b',
      startRow: 5,
      rowSpan: 1,
      crossesChannel: false,
    });
    expect(result?.snapPx).toEqual({ x: 40, y: 90 });
  });

  it('rejects non-terminal coordinates', () => {
    expect(resolveBoardDropPlacement({
      coord: { type: 'rail', rail: 'left_pos', index: 0 },
      type: 'resistor',
      pinCount: 2,
      existingPlacements: [],
    })).toBeNull();
  });

  it('rejects placements that collide with existing board parts', () => {
    const result = resolveBoardDropPlacement({
      coord: { type: 'terminal', col: 'c', row: 8 },
      type: 'resistor',
      pinCount: 2,
      existingPlacements: [
        { refDes: 'R1', startCol: 'c', startRow: 8, rowSpan: 1, crossesChannel: false },
      ],
    });

    expect(result).toBeNull();
  });
});

describe('getDropTypeFromPart', () => {
  it('prefers meta.type', () => {
    const part = makePart({ meta: { type: 'resistor', family: 'passive' } });
    expect(getDropTypeFromPart(part, 'component')).toBe('resistor');
  });

  it('falls back to meta.family when type is missing', () => {
    const part = makePart({ meta: { family: 'passive' } });
    expect(getDropTypeFromPart(part, 'component')).toBe('passive');
  });

  it('falls back to the provided fallback when both are missing', () => {
    const part = makePart({ meta: null });
    expect(getDropTypeFromPart(part, 'generic')).toBe('generic');
  });

  it('ignores empty-string type values', () => {
    const part = makePart({ meta: { type: '   ' } });
    expect(getDropTypeFromPart(part, 'fallback')).toBe('fallback');
  });

  it('returns fallback for undefined part', () => {
    expect(getDropTypeFromPart(undefined, 'capacitor')).toBe('capacitor');
  });
});

describe('drop instance drafts', () => {
  it('builds project bench drops with bench coordinates and project provenance', () => {
    const draft = buildProjectDropInstanceDraft({
      circuitId: 7,
      partId: 42,
      referenceDesignator: 'J1',
      placementMode: 'bench',
      pixel: { x: 128, y: 256 },
      label: 'Wide module',
      type: 'module',
    });

    expect(draft).toMatchObject({
      circuitId: 7,
      partId: 42,
      referenceDesignator: 'J1',
      benchX: 128,
      benchY: 256,
      properties: {
        breadboardProvenance: 'project',
        label: 'Wide module',
        type: 'module',
      },
    });
    expect('breadboardX' in draft).toBe(false);
    expect('breadboardY' in draft).toBe(false);
  });

  it('builds project board drops with breadboard coordinates and project provenance', () => {
    const draft = buildProjectDropInstanceDraft({
      circuitId: 7,
      partId: 42,
      referenceDesignator: 'R4',
      placementMode: 'board',
      pixel: { x: 80, y: 120 },
      label: '10k resistor',
      type: 'resistor',
    });

    expect(draft).toMatchObject({
      circuitId: 7,
      partId: 42,
      referenceDesignator: 'R4',
      breadboardX: 80,
      breadboardY: 120,
      properties: {
        breadboardProvenance: 'project',
        label: '10k resistor',
        type: 'resistor',
      },
    });
    expect('benchX' in draft).toBe(false);
    expect('benchY' in draft).toBe(false);
  });

  it('builds starter board drops with null part id and starter provenance', () => {
    const draft = buildStarterDropInstanceDraft({
      circuitId: 9,
      referenceDesignator: 'L1',
      pixel: { x: 44, y: 88 },
      type: 'led',
      label: '',
    });

    expect(draft).toMatchObject({
      circuitId: 9,
      partId: null,
      referenceDesignator: 'L1',
      breadboardX: 44,
      breadboardY: 88,
      properties: {
        breadboardProvenance: 'starter',
        label: 'led',
        type: 'led',
      },
    });
  });
});

describe('WIRE_COLORS', () => {
  it('exposes at least 10 distinct hex colors', () => {
    expect(WIRE_COLORS.length).toBeGreaterThanOrEqual(10);
    const unique = new Set(WIRE_COLORS);
    expect(unique.size).toBe(WIRE_COLORS.length);
    for (const color of WIRE_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
