import { SCHEMATIC_GRID } from '@protopulse/graph';
import { createRelayServer } from '@protopulse/relay';
import { afterEach, describe, expect, it } from 'vitest';

import { createSessionStore, getGraph } from './session.js';
import { SyncClient } from './sync.js';

import type { SyncInfo } from './sync.js';
import type { OpBody } from '@protopulse/graph';
import type { RelayServer } from '@protopulse/relay';

/**
 * The real thing end to end: two real session stores, two SyncClients
 * over Node's native WebSocket, one in-process relay. No mocks — this
 * is the collaboration path a browser pair takes.
 */

const G = SCHEMATIC_GRID;

function placeResistor(id: string, ref: string, x = 0): OpBody[] {
  return [
    { kind: 'add_component', id, ref, partId: 'core:resistor', partRev: 1 },
    { kind: 'place_symbol', componentId: id, at: { x, y: 0 }, rot: 0, mirror: false },
  ];
}

let server: RelayServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

async function until(cond: () => boolean, what: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

function harness() {
  const store = createSessionStore();
  let info: SyncInfo | null = null;
  const client = new SyncClient(store, (i) => {
    info = i;
  });
  return { store, client, info: () => info };
}

describe('sync (two editors, one relay)', () => {
  it('edits flow both ways and the graphs converge', async () => {
    server = await createRelayServer();
    const url = `ws://localhost:${String(server.port)}`;

    const a = harness();
    const b = harness();
    a.store.getState().dispatch(placeResistor('ra', 'R1'), 'add R1');

    a.client.connect(url, 'design-1');
    await until(() => a.info()?.status === 'on', 'A online');
    b.client.connect(url, 'design-1');
    await until(() => b.info()?.status === 'on', 'B online');

    // B receives A's pre-existing design via the snapshot.
    await until(() => getGraph(b.store.getState()).components.has('ra'), 'snapshot at B');

    // Live edit from B reaches A.
    b.store.getState().dispatch(placeResistor('rb', 'R2', 10 * G), 'add R2');
    await until(() => getGraph(a.store.getState()).components.has('rb'), 'live op at A');

    // Live edit from A reaches B.
    a.store.getState().dispatch(
      [{ kind: 'set_component_props', id: 'ra', props: { value: '47k' } }],
      'edit value',
    );
    await until(
      () => getGraph(b.store.getState()).components.get('ra')?.value === '47k',
      'value edit at B',
    );

    expect([...getGraph(a.store.getState()).components.keys()].sort()).toEqual(
      [...getGraph(b.store.getState()).components.keys()].sort(),
    );
    expect(a.info()?.peers).toBe(2);

    a.client.disconnect();
    b.client.disconnect();
    expect(a.info()?.status).toBe('off');
  });

  it('concurrent edits converge to the same graph on both sides', async () => {
    server = await createRelayServer();
    const url = `ws://localhost:${String(server.port)}`;
    const a = harness();
    const b = harness();
    a.client.connect(url, 'design-2');
    b.client.connect(url, 'design-2');
    await until(() => a.info()?.status === 'on' && b.info()?.status === 'on', 'both online');

    // Fire simultaneously — different actors, overlapping lamports.
    a.store.getState().dispatch(placeResistor('ra', 'R1'), 'A adds');
    b.store.getState().dispatch(placeResistor('rb', 'R2', 10 * G), 'B adds');

    await until(
      () =>
        getGraph(a.store.getState()).components.size === 2 &&
        getGraph(b.store.getState()).components.size === 2,
      'convergence',
    );
    const refsA = [...getGraph(a.store.getState()).components.values()].map((c) => c.ref).sort();
    const refsB = [...getGraph(b.store.getState()).components.values()].map((c) => c.ref).sort();
    expect(refsA).toEqual(refsB);

    a.client.disconnect();
    b.client.disconnect();
  });

  it('remote ops are not locally undoable; local undo still works and syncs', async () => {
    server = await createRelayServer();
    const url = `ws://localhost:${String(server.port)}`;
    const a = harness();
    const b = harness();
    a.client.connect(url, 'design-3');
    b.client.connect(url, 'design-3');
    await until(() => a.info()?.status === 'on' && b.info()?.status === 'on', 'both online');

    b.store.getState().dispatch(placeResistor('rb', 'R2'), 'B adds');
    await until(() => getGraph(a.store.getState()).components.has('rb'), 'B op at A');
    // A never dispatched — nothing for A to undo.
    expect(a.store.getState().canUndo).toBe(false);

    // A's own edit is undoable, and the undo (an inverse op) syncs to B.
    a.store.getState().dispatch(placeResistor('ra', 'R1', 10 * G), 'A adds');
    await until(() => getGraph(b.store.getState()).components.has('ra'), 'A op at B');
    a.store.getState().undo();
    await until(
      () => !getGraph(b.store.getState()).components.has('ra'),
      'undo propagated to B',
    );

    a.client.disconnect();
    b.client.disconnect();
  });

  it('a bad relay URL surfaces as an error state, not a crash', async () => {
    const a = harness();
    a.client.connect('ws://localhost:1', 'nope');
    await until(() => a.info()?.status === 'error', 'error state');
    expect(a.info()?.error).toContain('ws://localhost:1');
  });
});

describe('sync resilience', () => {
  it('relay death → reconnecting; relay revival → rejoin and union of offline edits', async () => {
    server = await createRelayServer();
    const port = server.port;
    const url = `ws://localhost:${String(port)}`;

    const mk = () => {
      const store = createSessionStore();
      let info: SyncInfo | null = null;
      const client = new SyncClient(store, (i) => { info = i; }, undefined, 25);
      return { store, client, info: () => info };
    };
    const a = mk();
    const b = mk();
    a.client.connect(url, 'resil');
    b.client.connect(url, 'resil');
    await until(() => a.info()?.status === 'on' && b.info()?.status === 'on', 'both online');

    // The relay dies.
    await server.close();
    server = null;
    await until(() => a.info()?.status === 'reconnecting', 'A noticed');
    await until(() => b.info()?.status === 'reconnecting', 'B noticed');

    // Both keep editing offline.
    a.store.getState().dispatch(placeResistor('ra', 'R1'), 'A offline edit');
    b.store.getState().dispatch(placeResistor('rb', 'R2', 10 * G), 'B offline edit');

    // The relay comes back on the same port (empty rooms — clients refill it).
    server = await createRelayServer({ port });
    await until(() => a.info()?.status === 'on' && b.info()?.status === 'on', 'both rejoined', 10_000);

    // Offline edits union both ways.
    await until(
      () =>
        getGraph(a.store.getState()).components.has('rb') &&
        getGraph(b.store.getState()).components.has('ra'),
      'offline edits converged',
      10_000,
    );

    a.client.disconnect();
    b.client.disconnect();
    expect(a.info()?.status).toBe('off');
  });

  it('manual disconnect during reconnecting cancels the retry loop', async () => {
    server = await createRelayServer();
    const url = `ws://localhost:${String(server.port)}`;
    const store = createSessionStore();
    // Accessor instead of a bare local: TS control flow can't see the
    // callback assignments and narrows a plain variable to never.
    let latest: SyncInfo | null = null;
    const info = (): SyncInfo | null => latest;
    const client = new SyncClient(store, (i) => { latest = i; }, undefined, 25);
    client.connect(url, 'cancel');
    await until(() => info()?.status === 'on', 'online');
    await server.close();
    server = null;
    await until(() => info()?.status === 'reconnecting', 'reconnecting');
    client.disconnect();
    expect(info()?.status).toBe('off');
    // Stays off — no zombie timer flips it back.
    await new Promise((r) => setTimeout(r, 200));
    expect(info()?.status).toBe('off');
  });
});
