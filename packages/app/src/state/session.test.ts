import { SCHEMATIC_GRID  } from '@protopulse/graph';
import { describe, expect, it, vi } from 'vitest';

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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createSessionStore();
    try {
      const ok = store.getState().dispatch([
        { kind: 'move_symbol', componentId: 'ghost', at: { x: 0, y: 0 }, rot: 0, mirror: false },
      ]);
      expect(ok).toBe(false);
      expect(warn).toHaveBeenCalledWith('dispatch rejected: component ghost not found');
      expect(getOpCount(store.getState())).toBe(0);
      expect(store.getState().canUndo).toBe(false);
    } finally {
      warn.mockRestore();
    }
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
    const first = ops[0];
    const second = ops[1];
    if (first === undefined || second === undefined) throw new Error('expected undo to append a second op');
    expect(second.lamport).toBeGreaterThan(first.lamport);
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
    expect(delta?.components.added).toEqual(['r2']);

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

describe('replay (time-travel)', () => {
  function threeOps(store: ReturnType<typeof createSessionStore>): void {
    store.getState().dispatch(placeResistor('r1', 'R1'), 'add R1');
    store.getState().dispatch(placeResistor('r2', 'R2', 10 * G), 'add R2');
    store.getState().dispatch(placeResistor('r3', 'R3', 20 * G), 'add R3');
  }

  it('getGraph returns the prefix materialization at the scrub position', () => {
    const store = createSessionStore();
    threeOps(store);
    store.getState().setReplayIndex(1);
    expect(getGraph(store.getState()).components.size).toBe(1);
    store.getState().setReplayIndex(2);
    expect(getGraph(store.getState()).components.size).toBe(2);
    store.getState().setReplayIndex(0);
    expect(getGraph(store.getState()).components.size).toBe(0);
    store.getState().setReplayIndex(null);
    expect(getGraph(store.getState()).components.size).toBe(3);
  });

  it('clamps the index to [0, opCount]', () => {
    const store = createSessionStore();
    threeOps(store);
    store.getState().setReplayIndex(99);
    expect(store.getState().replayIndex).toBe(3);
    store.getState().setReplayIndex(-5);
    expect(store.getState().replayIndex).toBe(0);
  });

  it('the session is read-only while replaying', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createSessionStore();
    try {
      threeOps(store);
      store.getState().setReplayIndex(1);
      expect(store.getState().dispatch(placeResistor('r4', 'R4', 30 * G))).toBe(false);
      expect(warn).toHaveBeenCalledWith('dispatch ignored: the session is replaying history (read-only)');
      expect(getOpCount(store.getState())).toBe(3);
      store.getState().undo();
      expect(getOpCount(store.getState())).toBe(3); // no inverse appended
      store.getState().redo();
      expect(getOpCount(store.getState())).toBe(3);
    } finally {
      warn.mockRestore();
    }
  });

  it('entering replay drops the selection (past graphs may lack it)', () => {
    const store = createSessionStore();
    threeOps(store);
    store.getState().setSelection(['r3']);
    store.getState().setReplayIndex(1);
    expect(store.getState().selection.size).toBe(0);
  });

  it('branch switches and bundle loads exit replay', () => {
    const store = createSessionStore();
    threeOps(store);
    store.getState().setReplayIndex(1);
    store.getState().createBranch('b2');
    expect(store.getState().replayIndex).toBeNull();

    store.getState().setReplayIndex(1);
    store.getState().switchBranch('main');
    expect(store.getState().replayIndex).toBeNull();
  });

  it('an index at the head equals the live graph', () => {
    const store = createSessionStore();
    threeOps(store);
    store.getState().setReplayIndex(3);
    expect(getGraph(store.getState()).components.size).toBe(3);
  });
});

describe('merge (interactive three-way)', () => {
  function forked() {
    const store = createSessionStore();
    store.getState().dispatch(placeResistor('r1', 'R1'));
    store.getState().createBranch('feature');
    return store;
  }

  it('clean merge: feature work lands on main as one batch', () => {
    const store = forked();
    store.getState().dispatch(placeResistor('r2', 'R2', 10 * G), 'add R2');
    store.getState().switchBranch('main');

    expect(store.getState().startMerge('feature')).toBe(true);
    const merge = store.getState().merge;
    expect(merge?.conflicts).toEqual([]);
    expect(merge?.autoOps.length).toBeGreaterThan(0);

    expect(store.getState().applyMerge()).toBe(true);
    expect(store.getState().merge).toBeNull();
    const graph = getGraph(store.getState());
    expect(graph.components.has('r2')).toBe(true);
    // One batch landed, parents recorded.
    const head = store.getState().core.log.opsFor('main').at(-1)?.op;
    expect(head).toMatchObject({ kind: 'batch', parents: ['main', 'feature'] });
  });

  it('conflicting values: nothing lands until every conflict is decided', () => {
    const store = forked();
    // feature edits R1's value…
    store.getState().dispatch(
      [{ kind: 'set_component_props', id: 'r1', props: { value: '1k' } }],
      'feature edit',
    );
    // …and main edits it differently.
    store.getState().switchBranch('main');
    store.getState().dispatch(
      [{ kind: 'set_component_props', id: 'r1', props: { value: '47k' } }],
      'main edit',
    );

    expect(store.getState().startMerge('feature')).toBe(true);
    expect(store.getState().merge?.conflicts).toHaveLength(1);
    expect(store.getState().applyMerge()).toBe(false); // undecided
    expect(store.getState().merge).not.toBeNull();

    store.getState().setMergeChoice(0, 'theirs');
    expect(store.getState().applyMerge()).toBe(true);
    expect(getGraph(store.getState()).components.get('r1')?.value).toBe('1k');
  });

  it("choosing 'ours' keeps the current branch's value", () => {
    const store = forked();
    store.getState().dispatch(
      [{ kind: 'set_component_props', id: 'r1', props: { value: '1k' } }],
    );
    store.getState().switchBranch('main');
    store.getState().dispatch(
      [{ kind: 'set_component_props', id: 'r1', props: { value: '47k' } }],
    );
    store.getState().startMerge('feature');
    store.getState().setMergeChoice(0, 'ours');
    expect(store.getState().applyMerge()).toBe(true);
    expect(getGraph(store.getState()).components.get('r1')?.value).toBe('47k');
  });

  it('up-to-date merge resolves without appending ops', () => {
    const store = forked();
    store.getState().switchBranch('main');
    const before = getOpCount(store.getState());
    store.getState().startMerge('feature');
    expect(store.getState().applyMerge()).toBe(true);
    expect(getOpCount(store.getState())).toBe(before);
  });

  it('guards: self-merge, unknown branch, replay mode', () => {
    const store = forked();
    expect(store.getState().startMerge('feature')).toBe(false); // current branch
    expect(store.getState().startMerge('ghost')).toBe(false);
    store.getState().setReplayIndex(0);
    expect(store.getState().startMerge('main')).toBe(false);
    store.getState().setReplayIndex(null);
  });

  it('an edit landed mid-merge invalidates the computed merge', () => {
    const store = forked();
    store.getState().dispatch(placeResistor('r2', 'R2', 10 * G));
    store.getState().switchBranch('main');
    store.getState().startMerge('feature');
    expect(store.getState().merge).not.toBeNull();
    store.getState().dispatch(placeResistor('r3', 'R3', 20 * G));
    expect(store.getState().merge).toBeNull();
  });

  it('branch switches cancel an open merge', () => {
    const store = forked();
    store.getState().switchBranch('main');
    store.getState().startMerge('feature');
    store.getState().switchBranch('feature');
    expect(store.getState().merge).toBeNull();
  });

  it('the merge batch is undoable like any other edit', () => {
    const store = forked();
    store.getState().dispatch(placeResistor('r2', 'R2', 10 * G));
    store.getState().switchBranch('main');
    store.getState().startMerge('feature');
    store.getState().applyMerge();
    expect(getGraph(store.getState()).components.has('r2')).toBe(true);
    store.getState().undo();
    expect(getGraph(store.getState()).components.has('r2')).toBe(false);
  });
});
