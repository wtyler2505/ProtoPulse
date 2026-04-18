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
  findAutoPlacement,
  getDropTypeFromPart,
  isDipLikeType,
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
