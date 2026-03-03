import { describe, it, expect } from 'vitest';
import { computePartDiff, applyPartialDiff } from '../diff-engine';
import type { PartState, RectShape, Connector } from '@shared/component-types';
import { createDefaultPartState } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRect(id: string, x = 0, y = 0, w = 50, h = 50): RectShape {
  return { id, type: 'rect', x, y, width: w, height: h, rotation: 0 };
}

function makeConnector(id: string, name: string): Connector {
  return {
    id,
    name,
    connectorType: 'male',
    shapeIds: {},
    terminalPositions: {},
  };
}

function makeState(overrides?: Partial<PartState>): PartState {
  const base = createDefaultPartState();
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// computePartDiff — shapes
// ---------------------------------------------------------------------------

describe('computePartDiff — shapes', () => {
  it('detects no changes when states are identical', () => {
    const state = makeState({
      views: {
        breadboard: { shapes: [makeRect('r1')] },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
    });
    const diff = computePartDiff(state, structuredClone(state));
    expect(diff.hasChanges).toBe(false);
    expect(diff.shapes).toEqual([]);
    expect(diff.connectors).toEqual([]);
    expect(diff.metaChanges).toEqual([]);
  });

  it('detects added shapes', () => {
    const before = makeState();
    const after = makeState({
      views: {
        breadboard: { shapes: [makeRect('r1')] },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
    });
    const diff = computePartDiff(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.shapesAdded).toBe(1);
    expect(diff.shapes[0].type).toBe('added');
    expect(diff.shapes[0].shapeId).toBe('r1');
    expect(diff.shapes[0].view).toBe('breadboard');
  });

  it('detects removed shapes', () => {
    const before = makeState({
      views: {
        breadboard: { shapes: [makeRect('r1')] },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
    });
    const after = makeState();
    const diff = computePartDiff(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.shapesRemoved).toBe(1);
    expect(diff.shapes[0].type).toBe('removed');
    expect(diff.shapes[0].shapeId).toBe('r1');
  });

  it('detects modified shapes', () => {
    const before = makeState({
      views: {
        breadboard: { shapes: [makeRect('r1', 0, 0)] },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
    });
    const after = makeState({
      views: {
        breadboard: { shapes: [makeRect('r1', 100, 200)] },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
    });
    const diff = computePartDiff(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.shapesModified).toBe(1);
    expect(diff.shapes[0].type).toBe('modified');
    expect(diff.shapes[0].before).toMatchObject({ x: 0, y: 0 });
    expect(diff.shapes[0].after).toMatchObject({ x: 100, y: 200 });
  });

  it('detects changes across multiple views', () => {
    const before = makeState({
      views: {
        breadboard: { shapes: [makeRect('r1')] },
        schematic: { shapes: [makeRect('s1')] },
        pcb: { shapes: [] },
      },
    });
    const after = makeState({
      views: {
        breadboard: { shapes: [] }, // r1 removed
        schematic: { shapes: [makeRect('s1'), makeRect('s2')] }, // s2 added
        pcb: { shapes: [makeRect('p1')] }, // p1 added
      },
    });
    const diff = computePartDiff(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.shapesRemoved).toBe(1);
    expect(diff.summary.shapesAdded).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computePartDiff — connectors
// ---------------------------------------------------------------------------

describe('computePartDiff — connectors', () => {
  it('detects added connectors', () => {
    const before = makeState();
    const after = makeState({ connectors: [makeConnector('c1', 'VCC')] });
    const diff = computePartDiff(before, after);
    expect(diff.summary.connectorsAdded).toBe(1);
    expect(diff.connectors[0].type).toBe('added');
    expect(diff.connectors[0].connectorId).toBe('c1');
  });

  it('detects removed connectors', () => {
    const before = makeState({ connectors: [makeConnector('c1', 'VCC')] });
    const after = makeState();
    const diff = computePartDiff(before, after);
    expect(diff.summary.connectorsRemoved).toBe(1);
    expect(diff.connectors[0].type).toBe('removed');
  });

  it('detects modified connectors', () => {
    const before = makeState({ connectors: [makeConnector('c1', 'VCC')] });
    const after = makeState({ connectors: [makeConnector('c1', 'GND')] });
    const diff = computePartDiff(before, after);
    expect(diff.summary.connectorsModified).toBe(1);
    expect(diff.connectors[0].type).toBe('modified');
  });
});

// ---------------------------------------------------------------------------
// computePartDiff — metadata
// ---------------------------------------------------------------------------

describe('computePartDiff — metadata', () => {
  it('detects title change', () => {
    const before = makeState();
    const after = makeState();
    after.meta.title = 'New Title';
    const diff = computePartDiff(before, after);
    expect(diff.summary.metaFieldsChanged).toBe(1);
    expect(diff.metaChanges[0].field).toBe('title');
    expect(diff.metaChanges[0].after).toBe('New Title');
  });

  it('detects tags change (array comparison)', () => {
    const before = makeState();
    before.meta.tags = ['sensor'];
    const after = makeState();
    after.meta.tags = ['sensor', 'digital'];
    const diff = computePartDiff(before, after);
    expect(diff.summary.metaFieldsChanged).toBeGreaterThanOrEqual(1);
    const tagDiff = diff.metaChanges.find(m => m.field === 'tags');
    expect(tagDiff).toBeDefined();
  });

  it('reports no meta changes when identical', () => {
    const before = makeState();
    before.meta.title = 'Same';
    const after = makeState();
    after.meta.title = 'Same';
    const diff = computePartDiff(before, after);
    const titleDiff = diff.metaChanges.find(m => m.field === 'title');
    expect(titleDiff).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyPartialDiff
// ---------------------------------------------------------------------------

describe('applyPartialDiff', () => {
  it('applies accepted added shapes', () => {
    const original = makeState();
    const modified = makeState({
      views: {
        breadboard: { shapes: [makeRect('r1', 10, 10)] },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
    });
    const diff = computePartDiff(original, modified);
    const result = applyPartialDiff(
      original, modified, diff,
      new Set(['r1']),   // accept shape r1
      new Set(),
      new Set(),
    );
    expect(result.views.breadboard.shapes).toHaveLength(1);
    expect(result.views.breadboard.shapes[0].id).toBe('r1');
  });

  it('rejects non-accepted shape additions', () => {
    const original = makeState();
    const modified = makeState({
      views: {
        breadboard: { shapes: [makeRect('r1')] },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
    });
    const diff = computePartDiff(original, modified);
    const result = applyPartialDiff(
      original, modified, diff,
      new Set(),    // reject all
      new Set(),
      new Set(),
    );
    expect(result.views.breadboard.shapes).toHaveLength(0);
  });

  it('applies accepted shape removals', () => {
    const original = makeState({
      views: {
        breadboard: { shapes: [makeRect('r1')] },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
    });
    const modified = makeState();
    const diff = computePartDiff(original, modified);
    const result = applyPartialDiff(
      original, modified, diff,
      new Set(['r1']),
      new Set(),
      new Set(),
    );
    expect(result.views.breadboard.shapes).toHaveLength(0);
  });

  it('applies accepted meta changes', () => {
    const original = makeState();
    const modified = makeState();
    modified.meta.title = 'Updated';
    const diff = computePartDiff(original, modified);
    const result = applyPartialDiff(
      original, modified, diff,
      new Set(),
      new Set(),
      new Set(['title']),
    );
    expect(result.meta.title).toBe('Updated');
  });

  it('rejects non-accepted meta changes', () => {
    const original = makeState();
    original.meta.title = 'Original';
    const modified = makeState();
    modified.meta.title = 'Updated';
    const diff = computePartDiff(original, modified);
    const result = applyPartialDiff(
      original, modified, diff,
      new Set(),
      new Set(),
      new Set(), // reject all meta
    );
    expect(result.meta.title).toBe('Original');
  });

  it('applies accepted connector additions', () => {
    const original = makeState();
    const modified = makeState({ connectors: [makeConnector('c1', 'VCC')] });
    const diff = computePartDiff(original, modified);
    const result = applyPartialDiff(
      original, modified, diff,
      new Set(),
      new Set(['c1']),
      new Set(),
    );
    expect(result.connectors).toHaveLength(1);
    expect(result.connectors[0].name).toBe('VCC');
  });

  it('does not mutate the original state', () => {
    const original = makeState();
    original.meta.title = 'Orig';
    const modified = makeState();
    modified.meta.title = 'Mod';
    const diff = computePartDiff(original, modified);
    applyPartialDiff(original, modified, diff, new Set(), new Set(), new Set(['title']));
    expect(original.meta.title).toBe('Orig');
  });
});
