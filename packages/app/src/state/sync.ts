import { opEnvelopeSchema } from '@protopulse/graph';
import { z } from 'zod';
import { create } from 'zustand';

import { useSession } from './session.js';

import type { SessionStore } from './session.js';
import type { OpEnvelope } from '@protopulse/graph';

/**
 * Live sync client (v0.6 first slice) — the editor side of
 * @protopulse/relay. The op-log is CRDT-shaped: envelopes are identified
 * by (actor, lamport) and materialization is a total order over them,
 * so sync is pure set-union — join with everything you have, push what's
 * new, ingest what arrives. No conflict resolution exists because none
 * is needed at this layer.
 *
 * Branch sync: every branch travels as {name, base, OWN ops} — the
 * inherited prefix is the base pointer, never re-carried. Remote
 * branches are adopted main-first (snapshots order them so bases
 * resolve); a same-named branch with a DIFFERENT base is unsyncable
 * and stays local, surfaced as a note rather than an error. Honest
 * scope: one tab per browser profile per design (tabs share the actor
 * id; concurrent same-actor tabs would collide on lamports).
 */

export const DEFAULT_RELAY_URL = 'ws://localhost:8787';
const PROTOCOL_VERSION = 1;

// Mirror of the relay's server→client schema (the relay package is a
// node server — the app validates frames itself rather than importing
// a ws-flavoured package into the browser bundle).
const branchSyncSchema = z.object({
  name: z.string().min(1),
  base: z.object({ branch: z.string().min(1).nullable(), opCount: z.number().int().nonnegative() }),
  envelopes: z.array(opEnvelopeSchema),
});

const serverMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('snapshot'),
    room: z.string(),
    envelopes: z.array(opEnvelopeSchema),
    branches: z.array(branchSyncSchema).optional(),
  }),
  z.object({
    kind: z.literal('ops'),
    branch: z.string().min(1).optional(),
    envelopes: z.array(opEnvelopeSchema),
  }),
  z.object({ kind: z.literal('peers'), count: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('error'), message: z.string() }),
]);

export type SyncStatus = 'off' | 'connecting' | 'on' | 'reconnecting' | 'error';

export interface SyncInfo {
  status: SyncStatus;
  url: string;
  room: string;
  peers: number;
  sent: number;
  received: number;
  error: string | null;
  /** Advisory sync notes (e.g. a branch kept local on base mismatch). */
  note: string | null;
}

const OFF: SyncInfo = {
  status: 'off',
  url: DEFAULT_RELAY_URL,
  room: '',
  peers: 0,
  sent: 0,
  received: 0,
  error: null,
  note: null,
};

interface SocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
}

type SocketFactory = (url: string) => SocketLike;

const defaultSocketFactory: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike;

function key(branch: string, env: OpEnvelope): string {
  return `${branch}|${env.actor}:${String(env.lamport)}`;
}

const MAIN = 'main';

/** One live connection. Pure against an injected session store —
 *  node tests run two of these against a real in-process relay.
 *
 *  Resilience: an UNEXPECTED close (relay restart, network blip)
 *  schedules a rejoin with exponential backoff. Rejoining is safe by
 *  construction — join carries the full local log and the snapshot
 *  brings the room's, so anything missed in either direction unions
 *  back in. Manual disconnect cancels everything. */
export class SyncClient {
  private socket: SocketLike | null = null;
  private unsubscribe: (() => void) | null = null;
  private seen = new Set<string>();
  private designId: string | null = null;
  private token: string | undefined;
  private info: SyncInfo = { ...OFF };
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wantLive = false;

  constructor(
    private readonly session: SessionStore,
    private readonly onChange: (info: SyncInfo) => void,
    private readonly socketFactory: SocketFactory = defaultSocketFactory,
    /** Backoff base; tests shrink it. Delay = base·2^attempt, cap 30s. */
    private readonly baseBackoffMs = 1_000,
  ) {}

  private update(patch: Partial<SyncInfo>): void {
    this.info = { ...this.info, ...patch };
    this.onChange(this.info);
  }

  connect(url: string, room: string, token?: string): void {
    this.disconnect();
    this.wantLive = true;
    this.attempts = 0;
    this.token = token !== undefined && token !== '' ? token : undefined;
    this.update({ ...OFF, status: 'connecting', url, room });
    this.designId = this.session.getState().designId;
    this.start();
  }

  private start(): void {
    const { url, room } = this.info;
    let socket: SocketLike;
    try {
      socket = this.socketFactory(url);
    } catch (err) {
      this.update({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      this.wantLive = false;
      return;
    }
    this.socket = socket;
    // A reconnect re-learns the world from the join/snapshot exchange.
    this.seen = new Set();

    socket.addEventListener('open', () => {
      this.sendJoin(socket, room);
      this.attempts = 0;
      this.update({ status: 'on' });
      this.unsubscribe ??= this.session.subscribe(() => {
        this.pushLocal();
      });
    });

    socket.addEventListener('message', (event) => {
      let msg;
      try {
        msg = serverMessageSchema.parse(JSON.parse(String(event.data)));
      } catch {
        return; // not ours — ignore
      }
      if (msg.kind === 'snapshot') {
        // Branch-aware rooms list every branch main-first; rooms from a
        // pre-branch relay carry only the flat main payload.
        const branches = msg.branches ?? [
          { name: MAIN, base: { branch: null, opCount: 0 }, envelopes: msg.envelopes },
        ];
        for (const incoming of branches) this.absorb(incoming.name, incoming.base, incoming.envelopes);
      } else if (msg.kind === 'ops') {
        this.absorb(msg.branch ?? MAIN, null, msg.envelopes);
      } else if (msg.kind === 'peers') {
        this.update({ peers: msg.count });
      } else if (msg.message.startsWith('branch ')) {
        // Advisory: one branch is unsyncable (base mismatch) — the rest
        // of the session keeps syncing.
        this.update({ note: msg.message });
      } else {
        // Relay-level errors (bad token, malformed frame) mean a retry
        // would just fail the same way — stop instead of loop.
        this.wantLive = false;
        this.teardown();
        this.update({ status: 'error', error: msg.message });
      }
    });

    socket.addEventListener('close', () => {
      this.socket = null;
      if (this.wantLive) this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      if (this.socket === null) return; // close already handled it
      this.socket = null;
      if (this.attempts === 0 && this.info.status === 'connecting') {
        // The very first dial failed — surface it instead of retrying
        // into the void (the URL is probably wrong).
        this.wantLive = false;
        this.teardown();
        this.update({ status: 'error', error: `could not reach ${this.info.url}` });
        return;
      }
      if (this.wantLive) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(this.baseBackoffMs * 2 ** this.attempts, 30_000);
    this.attempts += 1;
    this.update({ status: 'reconnecting' });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wantLive) this.start();
    }, delay);
  }

  disconnect(): void {
    this.wantLive = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket === null && this.unsubscribe === null) return;
    this.teardown();
    this.update({ ...OFF, url: this.info.url });
  }

  private teardown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    const s = this.socket;
    this.socket = null;
    this.seen.clear();
    this.designId = null;
    try {
      s?.close();
    } catch {
      // already closed
    }
  }

  /** Branches announced to the relay this connection (join carries
   *  them; a branch born later triggers a fresh announce). */
  private announced = new Set<string>();

  /** The full local state in wire shape: every branch's OWN ops. */
  private localBranches(): { name: string; base: { branch: string | null; opCount: number }; envelopes: OpEnvelope[] }[] {
    return this.session
      .getState()
      .core.log.entries()
      .map((b) => ({ name: b.name, base: { ...b.base }, envelopes: [...b.ops] }));
  }

  private sendJoin(socket: SocketLike, room: string): void {
    const branches = this.localBranches();
    this.announced = new Set(branches.map((b) => b.name));
    let sent = 0;
    for (const b of branches) {
      for (const env of b.envelopes) this.seen.add(key(b.name, env));
      sent += b.envelopes.length;
    }
    socket.send(
      JSON.stringify({
        kind: 'join',
        v: PROTOCOL_VERSION,
        room,
        ...(this.token !== undefined ? { token: this.token } : {}),
        envelopes: [],
        branches,
      }),
    );
    this.update({ sent: this.info.sent + sent });
  }

  /** Ingest one branch's remote envelopes; adopt the branch first when
   *  a base pointer travels with them (snapshots carry it, ops don't). */
  private absorb(
    branch: string,
    base: { branch: string | null; opCount: number } | null,
    envelopes: readonly OpEnvelope[],
  ): void {
    const session = this.session.getState();
    if (!session.core.log.has(branch)) {
      if (base === null) {
        // Ops raced ahead of the branch's snapshot — re-join to fetch
        // the pointer (idempotent; `seen` dedupes the echo).
        if (this.socket) this.sendJoin(this.socket, this.info.room);
        return;
      }
      const adopted = session.adoptRemoteBranch(branch, base);
      if (!adopted.ok) {
        this.update({ note: adopted.reason });
        return;
      }
      this.announced.add(branch);
    }
    const unseen = envelopes.filter((e) => !this.seen.has(key(branch, e)));
    for (const e of unseen) this.seen.add(key(branch, e));
    if (unseen.length > 0) {
      const fresh = this.session.getState().ingestRemote(unseen, branch);
      this.update({ received: this.info.received + fresh });
    }
  }

  private pushLocal(): void {
    const socket = this.socket;
    if (!socket || this.info.status !== 'on') return;
    // A design swap mid-session means the room no longer matches.
    if (this.session.getState().designId !== this.designId) {
      this.disconnect();
      return;
    }
    const branches = this.localBranches();
    // A branch born since the last announce: re-join (idempotent — the
    // relay unions; the snapshot reply dedupes through `seen`).
    if (branches.some((b) => !this.announced.has(b.name))) {
      this.sendJoin(socket, this.info.room);
      return;
    }
    for (const b of branches) {
      const fresh = b.envelopes.filter((e) => !this.seen.has(key(b.name, e)));
      if (fresh.length === 0) continue;
      for (const e of fresh) this.seen.add(key(b.name, e));
      socket.send(
        JSON.stringify({ kind: 'ops', room: this.info.room, branch: b.name, envelopes: fresh }),
      );
      this.update({ sent: this.info.sent + fresh.length });
    }
  }
}

// ── App-wide store ───────────────────────────────────────────────────

export interface SyncUiState extends SyncInfo {
  connect: (url: string, room: string, token?: string) => void;
  disconnect: () => void;
}

export const useSync = create<SyncUiState>()((set) => {
  const client = new SyncClient(useSession, (info) => {
    set(info);
  });
  return {
    ...OFF,
    connect: (url, room, token) => {
      client.connect(url, room, token);
    },
    disconnect: () => {
      client.disconnect();
    },
  };
});
