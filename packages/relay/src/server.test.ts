import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { materialize } from '@protopulse/graph';
import { afterEach, describe, expect, it } from 'vitest';

import { createRelayServer } from './server.js';
import { createFileStorage } from './storage.js';

import type { ServerMessage } from './protocol.js';
import type { OpEnvelope } from '@protopulse/graph';
import type { RelayServer } from './server.js';

/** Node 22 has a native WebSocket client — the same API the browser uses. */

let server: RelayServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

function env(actor: string, lamport: number, ref: string): OpEnvelope {
  return {
    actor,
    lamport,
    ts: 0,
    op: { kind: 'add_component', id: `${actor}-${String(lamport)}`, ref, partId: 'core:resistor', partRev: 1 },
  };
}

class TestClient {
  private ws: WebSocket;
  readonly received: ServerMessage[] = [];
  private waiters: ((msg: ServerMessage) => boolean)[] = [];

  constructor(port: number) {
    this.ws = new WebSocket(`ws://localhost:${String(port)}`);
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data)) as ServerMessage;
      this.received.push(msg);
      this.waiters = this.waiters.filter((w) => !w(msg));
    });
  }

  async open(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener('open', () => { resolve(); });
      this.ws.addEventListener('error', () => { reject(new Error('connect failed')); });
    });
  }

  send(msg: unknown): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** Resolve with the first (possibly already-received) matching message. */
  waitFor<K extends ServerMessage['kind']>(
    kind: K,
    pred: (m: Extract<ServerMessage, { kind: K }>) => boolean = () => true,
    timeoutMs = 5_000,
  ): Promise<Extract<ServerMessage, { kind: K }>> {
    const match = (m: ServerMessage): m is Extract<ServerMessage, { kind: K }> =>
      m.kind === kind && pred(m as Extract<ServerMessage, { kind: K }>);
    const hit = this.received.find(match);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timed out waiting for ${kind}`));
      }, timeoutMs);
      this.waiters.push((m) => {
        if (!match(m)) return false;
        clearTimeout(timer);
        resolve(m);
        return true;
      });
    });
  }

  close(): void {
    this.ws.close();
  }

  /** Every envelope this client has learned, snapshot + ops streams. */
  knownEnvelopes(initial: OpEnvelope[] = []): OpEnvelope[] {
    const byKey = new Map<string, OpEnvelope>();
    for (const e of initial) byKey.set(`${e.actor}:${String(e.lamport)}`, e);
    for (const m of this.received) {
      if (m.kind === 'snapshot' || m.kind === 'ops') {
        for (const e of m.envelopes) byKey.set(`${e.actor}:${String(e.lamport)}`, e);
      }
    }
    return [...byKey.values()];
  }
}

async function joined(port: number, room: string, envelopes: OpEnvelope[] = []): Promise<TestClient> {
  const c = new TestClient(port);
  await c.open();
  c.send({ kind: 'join', v: 1, room, envelopes });
  await c.waitFor('snapshot');
  return c;
}

describe('relay server', () => {
  it('join → snapshot; ops broadcast to the other peer, not the sender', async () => {
    server = await createRelayServer();
    const a = await joined(server.port, 'r1', [env('alice', 1, 'R1')]);
    const b = await joined(server.port, 'r1');

    // B's snapshot carries alice's op.
    const snap = await b.waitFor('snapshot');
    expect(snap.envelopes).toHaveLength(1);
    expect(snap.envelopes[0]?.actor).toBe('alice');

    b.send({ kind: 'ops', room: 'r1', envelopes: [env('bob', 1, 'R2')] });
    const relayed = await a.waitFor('ops', (m) => m.envelopes.some((e) => e.actor === 'bob'));
    expect(relayed.envelopes).toHaveLength(1);
    // The sender does not get its own ops echoed.
    expect(b.received.filter((m) => m.kind === 'ops' && m.envelopes.some((e) => e.actor === 'bob'))).toHaveLength(0);

    a.close();
    b.close();
  });

  it('late joiner converges: same envelope set, same materialized graph', async () => {
    server = await createRelayServer();
    const a = await joined(server.port, 'conv', [env('alice', 1, 'R1'), env('alice', 2, 'R2')]);
    a.send({ kind: 'ops', room: 'conv', envelopes: [env('alice', 3, 'R3')] });

    // B joins late with its own concurrent op.
    const b = await joined(server.port, 'conv', [env('bob', 1, 'R9')]);
    const aFromB = await a.waitFor('ops', (m) => m.envelopes.some((e) => e.actor === 'bob'));
    expect(aFromB.envelopes).toHaveLength(1);

    const aKnown = a.knownEnvelopes([env('alice', 1, 'R1'), env('alice', 2, 'R2'), env('alice', 3, 'R3')]);
    const bKnown = b.knownEnvelopes([env('bob', 1, 'R9')]);
    expect(aKnown).toHaveLength(4);
    expect(bKnown).toHaveLength(4);

    const graphA = materialize(aKnown).graph;
    const graphB = materialize(bKnown).graph;
    expect([...graphA.components.keys()].sort()).toEqual([...graphB.components.keys()].sort());
    expect(graphA.components.size).toBe(4);

    a.close();
    b.close();
  });

  it('duplicate envelopes are unioned away, never re-broadcast', async () => {
    server = await createRelayServer();
    const a = await joined(server.port, 'dup', [env('alice', 1, 'R1')]);
    const b = await joined(server.port, 'dup');
    // B re-sends alice's op (e.g. after a reconnect race).
    b.send({ kind: 'ops', room: 'dup', envelopes: [env('alice', 1, 'R1')] });
    b.send({ kind: 'ops', room: 'dup', envelopes: [env('bob', 1, 'R2')] });
    await a.waitFor('ops', (m) => m.envelopes.some((e) => e.actor === 'bob'));
    const opsToA = a.received.filter((m) => m.kind === 'ops');
    expect(opsToA.flatMap((m) => m.envelopes)).toHaveLength(1);
    a.close();
    b.close();
  });

  it('peer counts track joins and disconnects', async () => {
    server = await createRelayServer();
    const a = await joined(server.port, 'peers');
    await a.waitFor('peers', (m) => m.count === 1);
    const b = await joined(server.port, 'peers');
    await a.waitFor('peers', (m) => m.count === 2);
    b.close();
    await a.waitFor('peers', (m) => m.count === 1);
    a.close();
  });

  it('rejects malformed frames and ops-before-join with error replies', async () => {
    server = await createRelayServer();
    const c = new TestClient(server.port);
    await c.open();
    c.send({ kind: 'nonsense' });
    await c.waitFor('error', (m) => m.message.startsWith('bad message'));
    c.send({ kind: 'ops', room: 'ghost', envelopes: [env('x', 1, 'R1')] });
    await c.waitFor('error', (m) => m.message.includes('join the room'));
    c.close();
  });

  it('the room log survives everyone leaving', async () => {
    server = await createRelayServer();
    const a = await joined(server.port, 'persist', [env('alice', 1, 'R1')]);
    a.close();
    // Give the close a beat to land server-side.
    await new Promise((r) => setTimeout(r, 100));
    const b = await joined(server.port, 'persist');
    const snap = await b.waitFor('snapshot');
    expect(snap.envelopes).toHaveLength(1);
    b.close();
  });

  it('a token-gated relay rejects bad/missing tokens and admits the right one', async () => {
    server = await createRelayServer({ token: 'sesame' });

    const noToken = new TestClient(server.port);
    await noToken.open();
    noToken.send({ kind: 'join', v: 1, room: 'gated', envelopes: [] });
    await noToken.waitFor('error', (m) => m.message.includes('unauthorized'));

    const wrong = new TestClient(server.port);
    await wrong.open();
    wrong.send({ kind: 'join', v: 1, room: 'gated', token: 'guess', envelopes: [] });
    await wrong.waitFor('error', (m) => m.message.includes('unauthorized'));
    expect(server.roomCount()).toBe(0); // nothing joined, nothing created

    const right = new TestClient(server.port);
    await right.open();
    right.send({ kind: 'join', v: 1, room: 'gated', token: 'sesame', envelopes: [env('alice', 1, 'R1')] });
    const snap = await right.waitFor('snapshot');
    expect(snap.envelopes).toHaveLength(1);
    right.close();
    noToken.close();
    wrong.close();
  });

  it('with file storage, rooms survive a relay RESTART (and corrupt tails are skipped)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pp-relay-'));
    server = await createRelayServer({ storage: createFileStorage(dir) });
    const a = await joined(server.port, 'durable/room', [env('alice', 1, 'R1'), env('alice', 2, 'R2')]);
    a.close();
    await server.close();
    server = null;

    // Simulate a crash mid-append: a partial trailing line (real
    // appends lead with \n, so the partial stays isolated).
    const file = join(dir, `${encodeURIComponent('durable/room')}.jsonl`);
    appendFileSync(file, '\n{"actor":"alice","lamp');

    server = await createRelayServer({ storage: createFileStorage(dir) });
    const b = await joined(server.port, 'durable/room');
    const snap = await b.waitFor('snapshot');
    expect(snap.envelopes.map((e) => e.lamport).sort()).toEqual([1, 2]);

    // New ops keep appending after the reload.
    b.send({ kind: 'ops', room: 'durable/room', envelopes: [env('bob', 1, 'R3')] });
    await new Promise((r) => setTimeout(r, 100));
    b.close();
    await server.close();
    server = null;

    server = await createRelayServer({ storage: createFileStorage(dir) });
    const c = await joined(server.port, 'durable/room');
    const snap2 = await c.waitFor('snapshot');
    expect(snap2.envelopes).toHaveLength(3);
    c.close();
  });
});

describe('branch sync', () => {
  it('branches travel as {name, base, own ops}; joiners adopt them main-first', async () => {
    server = await createRelayServer();
    const a = new TestClient(server.port);
    await a.open();
    a.send({
      kind: 'join',
      v: 1,
      room: 'br',
      envelopes: [],
      branches: [
        { name: 'main', base: { branch: null, opCount: 0 }, envelopes: [env('alice', 1, 'R1')] },
        { name: 'feature', base: { branch: 'main', opCount: 1 }, envelopes: [env('alice', 2, 'R2')] },
      ],
    });
    await a.waitFor('snapshot');

    const b = await joined(server.port, 'br');
    const snap = await b.waitFor('snapshot');
    expect(snap.branches?.map((br) => br.name)).toEqual(['main', 'feature']);
    expect(snap.branches?.[1]?.base).toEqual({ branch: 'main', opCount: 1 });
    expect(snap.branches?.[1]?.envelopes.map((e) => e.lamport)).toEqual([2]);

    // Ops on a branch broadcast with the branch tag.
    b.send({ kind: 'ops', room: 'br', branch: 'feature', envelopes: [env('bob', 3, 'R3')] });
    const relayed = await a.waitFor('ops', (m) => m.envelopes.some((e) => e.actor === 'bob'));
    expect(relayed.branch).toBe('feature');
    a.close();
    b.close();
  });

  it('a same-named branch with a different base is refused as an advisory', async () => {
    server = await createRelayServer();
    const a = new TestClient(server.port);
    await a.open();
    a.send({
      kind: 'join', v: 1, room: 'clash', envelopes: [],
      branches: [
        { name: 'main', base: { branch: null, opCount: 0 }, envelopes: [env('alice', 1, 'R1'), env('alice', 2, 'R2')] },
        { name: 'feature', base: { branch: 'main', opCount: 2 }, envelopes: [] },
      ],
    });
    await a.waitFor('snapshot');

    const b = new TestClient(server.port);
    await b.open();
    b.send({
      kind: 'join', v: 1, room: 'clash', envelopes: [],
      branches: [{ name: 'feature', base: { branch: 'main', opCount: 1 }, envelopes: [env('bob', 9, 'R9')] }],
    });
    await b.waitFor('error', (m) => m.message.includes('base mismatch'));
    // The room keeps its first-seen fork; bob's divergent ops never land.
    const snap = await b.waitFor('snapshot');
    expect(snap.branches?.find((br) => br.name === 'feature')?.base.opCount).toBe(2);
    expect(snap.branches?.find((br) => br.name === 'feature')?.envelopes).toEqual([]);
    a.close();
    b.close();
  });
});
