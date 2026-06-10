import { SCHEMATIC_GRID  } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { createSessionStore, getDiffDelta, getGraph, getOpCount } from './session.js';

import type {OpBody} from '@protopulse/graph';

const G = SCHEMATIC_GRID;

function placeResistor(id: string, ref: string, x = 0): OpBody[] {
  return [
    { kind: 'add_component', id, ref, partId: 'core:resistor', partRev: 1 },
    { kind: 'place_symbol', componentId: id, at: { x, y: 0 }, rot: 0, mirror: false },
  ];
}

describe('session dispatch / undo / redo', () => {
  it('dispatch materializes the ops into the graph', () => {
    const store = createSessionStore();
    expect(store.getState().dispatch(placeResistor('r1', 'R1'), 'add R1')).toBe(true);
    const graph = getGraph(store.getState());
    expect(graph.components.get('r1')?.ref).toBe('R1');
    expect(graph.schematic.placements.has('r1')).toBe(true);
    expect(getOpCount(store.getState())).toBe(1); // batched = one envelope
  });

  it('rejects ops that fail to apply and leaves the log clean', () => {
    const store = createSessionStore();
    const ok = store.getState().dispatch([
      { kind: 'move_symbol', componentId: 'ghost', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    ]);
    expect(ok).toBe(false);
    expect(getOpCount(store.getState())).toBe(0);
    expect(store.getState().canUndo).toBe(false);
  });

  it('undo/redo round-trips a batch as one unit', () => {
    const store = createSessionStore();
    store.getState().dispatch(placeResistor('r1', 'R1'), 'add R1');
    expect(store.getState().canUndo).toBe(true);

    store.getState().undo();
    expect(getGraph(store.getState()).components.size).toBe(0);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(true);

    store.getState().redo();
    const graph = getGraph(store.getState());
    expect(graph.components.get('r1')?.ref).toBe('R1');
    expect(graph.schematic.placements.has('r1')).toBe(true);
    expect(store.getState().canUndo).toBe(true);
    expect(store.getState().canRedo).toBe(false);
  });

  it('undo of a move restores the previous placement', () => {
    const store = createSessionStore();
    store.getState().dispatch(placeResistor('r1', 'R1'));
    store.getState().dispatch([
      { kind: 'move_symbol', componentId: 'r1', at: { x: 4 * G, y: 2 * G }, rot: 90, mirror: false },
    ]);
    expect(getGraph(store.getState()).schematic.placements.get('r1')?.at).toEqual({
      x: 4 * G,
      y: 2 * G,
    });
    store.getState().undo();
    const placement = getGraph(store.getState()).schematic.placements.get('r1');
    expect(placement?.at).toEqual({ x: 0, y: 0 });
    expect(placement?.rot).toBe(0);
  });

  it('a new dispatch clears the redo stack', () => {
    const store = createSessionStore();
    store.getState().dispatch(placeResistor('r1', 'R1'));
    store.getState().undo();
    expect(store.getState().canRedo).toBe(true);
    store.getState().dispatch(placeResistor('r2', 'R2'));
    expect(store.getState().canRedo).toBe(false);
  });

  it('lamport increases per envelope and the log is forward-only', () => {
    const store = createSessionStore();
    store.getState().dispatch(placeResistor('r1', 'R1'));
    store.getState().undo(); // appends inverse ops — history is honest
    const core = store.getState().core;
    const ops = core.log.opsFor(store.getState().branch);
    expect(ops.length).toBe(2);
    expect(ops[1]!.lamport).toBeGreaterThan(ops[0]!.lamport);
  });
});

describe('branches and diff', () => {
  it('createBranch forks from the current head and switches to it', () => {
    const store = createSessionStore();
    store.getState().dispatch(placeResistor('r1', 'R1'));
    expect(store.getState().createBranch('experiment')).toBe(true);
    expect(store.getState().branch).toBe('experiment');
    expect(getGraph(store.getState()).components.has('r1')).toBe(true);

    store.getState().dispatch(placeResistor('r2', 'R2', 10 * G));
    expect(getGraph(store.getState()).components.size).toBe(2);

    store.getState().switchBranch('main');
    expect(getGraph(store.getState()).components.size).toBe(1);
  });

  it('rejects duplicate or empty branch names', () => {
    const store = createSessionStore();
    expect(store.getState().createBranch('main')).toBe(false);
    expect(store.getState().createBranch('  ')).toBe(false);
  });

  it('diffAgainst exposes the delta between branches', () => {
    const store = createSessionStore();
    store.getState().dispatch(placeResistor('r1', 'R1'));
    store.getState().createBranch('experiment');
    store.getState().dispatch(placeResistor('r2', 'R2', 10 * G));

    store.getState().setDiffAgainst('main');
    const delta = getDiffDelta(store.getState());
    expect(delta).not.toBeNull();
    expect(delta!.components.added).toEqual(['r2']);

    store.getState().setDiffAgainst(null);
    expect(getDiffDelta(store.getState())).toBeNull();
  });

  it('setDiffAgainst the current branch is a no-op (null)', () => {
    const store = createSessionStore();
    store.getState().setDiffAgainst('main');
    expect(store.getState().diffAgainst).toBeNull();
  });

  it('switching branches clears selection and undo stacks', () => {
    const store = createSessionStore();
    store.getState().dispatch(placeResistor('r1', 'R1'));
    store.getState().setSelection(['r1']);
    store.getState().createBranch('b2');
    expect(store.getState().selection.size).toBe(0);
    expect(store.getState().canUndo).toBe(false);
  });
});

describe('selection', () => {
  it('setSelection / clearSelection replace the set', () => {
    const store = createSessionStore();
    store.getState().setSelection(['a', 'b']);
    expect([...store.getState().selection].sort()).toEqual(['a', 'b']);
    store.getState().clearSelection();
    expect(store.getState().selection.size).toBe(0);
  });
});
