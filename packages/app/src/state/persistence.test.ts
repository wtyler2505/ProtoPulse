import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBundle, encodeBundle } from '@protopulse/graph';
import {
  bundleFromCore,
  createAutosave,
  loadBundle,
  loadFixture,
  saveBundle,
  STORAGE_KEY,
  type StorageLike,
} from './persistence.js';
import { createSessionStore } from './session.js';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

describe('bundle round trip', () => {
  it('encode → decode preserves branches, ops, and head', () => {
    const store = createSessionStore();
    store.getState().dispatch([
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    ]);
    store.getState().createBranch('experiment');
    store.getState().dispatch([
      { kind: 'place_symbol', componentId: 'r1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    ]);

    const s = store.getState();
    const bundle = bundleFromCore(s.core, s.branch);
    const decoded = decodeBundle(encodeBundle(bundle));

    expect(decoded.head).toBe('experiment');
    expect(decoded.designId).toBe(s.designId);
    expect(decoded.branches.map((b) => b.name).sort()).toEqual(['experiment', 'main']);
    const main = decoded.branches.find((b) => b.name === 'main')!;
    const exp = decoded.branches.find((b) => b.name === 'experiment')!;
    expect(main.ops.length).toBe(1);
    expect(exp.base).toEqual({ branch: 'main', opCount: 1 });
    expect(exp.ops.length).toBe(1);
  });

  it('a decoded bundle rehydrates into a working session', () => {
    const store = createSessionStore();
    store.getState().dispatch([
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    ]);
    const s = store.getState();
    const text = encodeBundle(bundleFromCore(s.core, s.branch));

    const store2 = createSessionStore(decodeBundle(text));
    expect(store2.getState().core.opCount('main')).toBe(1);
    expect(store2.getState().core.graphFor('main').components.get('r1')?.ref).toBe('R1');
    // lamport resumes past the imported ops
    store2.getState().dispatch([
      { kind: 'set_component_props', id: 'r1', props: { value: '10k' } },
    ]);
    const ops = store2.getState().core.log.opsFor('main');
    expect(ops[1]!.lamport).toBeGreaterThan(ops[0]!.lamport);
  });
});

describe('saveBundle / loadBundle', () => {
  it('round-trips through a storage', () => {
    const storage = fakeStorage();
    const bundle = loadFixture();
    saveBundle(bundle, storage);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
    expect(loadBundle(storage)).toEqual(bundle);
  });

  it('returns null on empty or corrupt storage', () => {
    const storage = fakeStorage();
    expect(loadBundle(storage)).toBeNull();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadBundle(storage)).toBeNull();
  });
});

describe('autosave debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists once after the debounce window, collapsing bursts', () => {
    const storage = fakeStorage();
    let calls = 0;
    const autosave = createAutosave(
      () => {
        calls++;
        return loadFixture();
      },
      storage,
      1000,
    );

    autosave.schedule();
    autosave.schedule();
    autosave.schedule();
    expect(calls).toBe(0);
    vi.advanceTimersByTime(999);
    expect(calls).toBe(0);
    vi.advanceTimersByTime(1);
    expect(calls).toBe(1);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
    autosave.dispose();
  });

  it('flush persists immediately and cancels the pending timer', () => {
    const storage = fakeStorage();
    let calls = 0;
    const autosave = createAutosave(
      () => {
        calls++;
        return loadFixture();
      },
      storage,
      1000,
    );
    autosave.schedule();
    autosave.flush();
    expect(calls).toBe(1);
    vi.advanceTimersByTime(2000);
    expect(calls).toBe(1); // pending timer was cancelled
  });
});

describe('loadFixture', () => {
  it('is a valid, decodable starter bundle', () => {
    const fixture = loadFixture();
    expect(() => decodeBundle(encodeBundle(fixture))).not.toThrow();
    expect(fixture.head).toBe('main');
    expect(fixture.branches[0]!.ops).toEqual([]);
  });
});
