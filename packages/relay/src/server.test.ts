import { materialize } from '@protopulse/graph';
import { afterEach, describe, expect, it } from 'vitest';

import { createRelayServer } from './server.js';

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
    expect(opsToA.flatMap((m) => (m.kind === 'ops' ? m.envelopes : []))).toHaveLength(1);
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
});
