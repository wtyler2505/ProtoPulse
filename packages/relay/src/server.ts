import { WebSocketServer } from 'ws';

import {
  clientMessageSchema,
  compareEnvelopes,
  envelopeKey,
  MAX_MESSAGE_BYTES,
} from './protocol.js';

import type { ServerMessage } from './protocol.js';
import type { RoomStorage } from './storage.js';
import type { OpEnvelope } from '@protopulse/graph';
import type { WebSocket } from 'ws';

/**
 * The relay server: rooms of clients sharing one op-log. State lives
 * in memory — the relay CARRIES designs, it never owns them (every
 * client keeps its own copy; an empty relay refills from the first
 * client to join). With `storage` set, rooms also append to disk so a
 * RESTARTED relay re-seeds before any client rejoins — still a cache,
 * never the authority. With `token` set, joins must present it.
 * Unknown or malformed frames get an error reply and are otherwise
 * ignored; a misbehaving peer can't corrupt a room because
 * union-by-key is idempotent and ops are schema-validated.
 */

interface BranchLog {
  base: { branch: string | null; opCount: number };
  log: Map<string, OpEnvelope>;
}

interface Room {
  /** Per-branch logs; 'main' always exists. */
  branches: Map<string, BranchLog>;
  clients: Set<WebSocket>;
}

const MAIN = 'main';

export interface RelayServer {
  port: number;
  /** Rooms currently alive (tests + ops introspection). */
  roomCount: () => number;
  close: () => Promise<void>;
}

export interface RelayOpts {
  port?: number;
  /** Shared secret; when set, join messages must carry it. */
  token?: string;
  /** Room persistence (createFileStorage); omit for memory-only. */
  storage?: RoomStorage;
}

export function createRelayServer(opts: RelayOpts = {}): Promise<RelayServer> {
  const wss = new WebSocketServer({
    port: opts.port ?? 0,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  const rooms = new Map<string, Room>();
  const roomOf = new Map<WebSocket, string>();

  const send = (ws: WebSocket, msg: ServerMessage): void => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const broadcast = (room: Room, msg: ServerMessage, except?: WebSocket): void => {
    for (const client of room.clients) {
      if (client !== except) send(client, msg);
    }
  };

  /** Get-or-create a branch log within a room. The relay keeps its
   *  FIRST-SEEN base for a name; a mismatched later base is refused. */
  const branchFor = (
    room: Room,
    name: string,
    base: { branch: string | null; opCount: number },
  ): BranchLog | { mismatch: true } => {
    const existing = room.branches.get(name);
    if (existing) {
      if (existing.base.branch !== base.branch || existing.base.opCount !== base.opCount) {
        return { mismatch: true };
      }
      return existing;
    }
    const created: BranchLog = { base: { ...base }, log: new Map() };
    room.branches.set(name, created);
    return created;
  };

  /** Union envelopes into one branch's log (and storage); returns the
   *  genuinely new ones. */
  const unionInto = (
    roomName: string,
    room: Room,
    branch: string,
    envelopes: readonly OpEnvelope[],
  ): OpEnvelope[] => {
    const target = room.branches.get(branch);
    if (!target) return [];
    const fresh: OpEnvelope[] = [];
    for (const env of envelopes) {
      const key = envelopeKey(env);
      if (target.log.has(key)) continue;
      target.log.set(key, env);
      fresh.push(env);
    }
    if (fresh.length > 0) {
      opts.storage?.append(roomName, fresh.map((env) => ({ branch, base: target.base, env })));
    }
    return fresh;
  };

  /** Get-or-create a room, seeding from storage on first touch. */
  const roomFor = (name: string): Room => {
    let room = rooms.get(name);
    if (!room) {
      room = { branches: new Map(), clients: new Set() };
      room.branches.set(MAIN, { base: { branch: null, opCount: 0 }, log: new Map() });
      for (const rec of opts.storage?.load(name) ?? []) {
        const target = branchFor(room, rec.branch, rec.base);
        if (!('mismatch' in target)) target.log.set(envelopeKey(rec.env), rec.env);
      }
      rooms.set(name, room);
    }
    return room;
  };

  /** Every branch as wire shape, main FIRST so bases resolve in order. */
  const snapshotBranches = (room: Room) =>
    [...room.branches.entries()]
      .sort(([a], [b]) => (a === MAIN ? -1 : b === MAIN ? 1 : a < b ? -1 : 1))
      .map(([name, b]) => ({
        name,
        base: { ...b.base },
        envelopes: [...b.log.values()].sort(compareEnvelopes),
      }));

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      // ws RawData is Buffer | ArrayBuffer | Buffer[] — decode explicitly.
      const text = Buffer.isBuffer(data)
        ? data.toString('utf8')
        : Array.isArray(data)
          ? Buffer.concat(data).toString('utf8')
          : Buffer.from(data).toString('utf8');
      let msg;
      try {
        msg = clientMessageSchema.parse(JSON.parse(text));
      } catch (err) {
        send(ws, {
          kind: 'error',
          message: `bad message: ${err instanceof Error ? err.message.slice(0, 200) : 'unparseable'}`,
        });
        return;
      }

      if (msg.kind === 'join') {
        if (opts.token !== undefined && msg.token !== opts.token) {
          send(ws, { kind: 'error', message: 'unauthorized: bad or missing token' });
          ws.close();
          return;
        }
        // Leaving a previous room is implicit — one room per socket.
        const prevName = roomOf.get(ws);
        if (prevName !== undefined) {
          const prev = rooms.get(prevName);
          prev?.clients.delete(ws);
          if (prev) broadcast(prev, { kind: 'peers', count: prev.clients.size });
        }
        const room = roomFor(msg.room);
        // v1 payload lands on main; branch-aware joins union per branch.
        const joinBranches =
          msg.branches ??
          (msg.envelopes.length > 0
            ? [{ name: MAIN, base: { branch: null, opCount: 0 }, envelopes: msg.envelopes }]
            : []);
        for (const incoming of joinBranches) {
          const target = branchFor(room, incoming.name, incoming.base);
          if ('mismatch' in target) {
            send(ws, {
              kind: 'error',
              message: `branch ${incoming.name}: base mismatch — the room has a different fork; keep it local`,
            });
            continue;
          }
          const fresh = unionInto(msg.room, room, incoming.name, incoming.envelopes);
          if (fresh.length > 0) {
            broadcast(room, { kind: 'ops', branch: incoming.name, envelopes: fresh }, ws);
          }
        }
        room.clients.add(ws);
        roomOf.set(ws, msg.room);
        // The joiner gets the whole room; everyone else got the news above.
        const main = room.branches.get(MAIN);
        send(ws, {
          kind: 'snapshot',
          room: msg.room,
          envelopes: main ? [...main.log.values()].sort(compareEnvelopes) : [],
          branches: snapshotBranches(room),
        });
        broadcast(room, { kind: 'peers', count: room.clients.size });
        return;
      }

      // msg.kind === 'ops'
      const joined = roomOf.get(ws);
      if (joined !== msg.room) {
        send(ws, { kind: 'error', message: 'join the room before sending ops' });
        return;
      }
      const room = rooms.get(msg.room);
      if (!room) return;
      const branch = msg.branch ?? MAIN;
      if (!room.branches.has(branch)) {
        send(ws, { kind: 'error', message: `branch ${branch} is not in this room — join announces branches` });
        return;
      }
      const fresh = unionInto(msg.room, room, branch, msg.envelopes);
      if (fresh.length > 0) broadcast(room, { kind: 'ops', branch, envelopes: fresh }, ws);
    });

    ws.on('close', () => {
      const name = roomOf.get(ws);
      roomOf.delete(ws);
      if (name === undefined) return;
      const room = rooms.get(name);
      if (!room) return;
      room.clients.delete(ws);
      broadcast(room, { kind: 'peers', count: room.clients.size });
      // Empty rooms keep their log — a lone editor refreshing shouldn't
      // lose the room. Memory is bounded by design size, not time.
    });
  });

  return new Promise((resolve, reject) => {
    wss.once('error', reject);
    wss.once('listening', () => {
      const address = wss.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        port,
        roomCount: () => rooms.size,
        close: () =>
          new Promise<void>((res) => {
            for (const ws of wss.clients) ws.terminate();
            wss.close(() => {
              res();
            });
          }),
      });
    });
  });
}
