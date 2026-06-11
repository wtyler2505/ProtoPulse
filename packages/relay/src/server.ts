import { WebSocketServer } from 'ws';

import {
  clientMessageSchema,
  compareEnvelopes,
  envelopeKey,
  MAX_MESSAGE_BYTES,
} from './protocol.js';

import type { ServerMessage } from './protocol.js';
import type { OpEnvelope } from '@protopulse/graph';
import type { WebSocket } from 'ws';

/**
 * The relay server: rooms of clients sharing one op-log. All state is
 * in memory — the relay CARRIES designs, it never owns them (every
 * client keeps its own copy; an empty relay refills from the first
 * client to join). Unknown or malformed frames get an error reply and
 * are otherwise ignored; a misbehaving peer can't corrupt a room
 * because union-by-key is idempotent and ops are schema-validated.
 */

interface Room {
  log: Map<string, OpEnvelope>;
  clients: Set<WebSocket>;
}

export interface RelayServer {
  port: number;
  /** Rooms currently alive (tests + ops introspection). */
  roomCount: () => number;
  close: () => Promise<void>;
}

export function createRelayServer(opts: { port?: number } = {}): Promise<RelayServer> {
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

  /** Union envelopes into the room log; returns the genuinely new ones. */
  const unionInto = (room: Room, envelopes: readonly OpEnvelope[]): OpEnvelope[] => {
    const fresh: OpEnvelope[] = [];
    for (const env of envelopes) {
      const key = envelopeKey(env);
      if (room.log.has(key)) continue;
      room.log.set(key, env);
      fresh.push(env);
    }
    return fresh;
  };

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try {
        msg = clientMessageSchema.parse(JSON.parse(String(data)));
      } catch (err) {
        send(ws, {
          kind: 'error',
          message: `bad message: ${err instanceof Error ? err.message.slice(0, 200) : 'unparseable'}`,
        });
        return;
      }

      if (msg.kind === 'join') {
        // Leaving a previous room is implicit — one room per socket.
        const prevName = roomOf.get(ws);
        if (prevName !== undefined) {
          const prev = rooms.get(prevName);
          prev?.clients.delete(ws);
          if (prev) broadcast(prev, { kind: 'peers', count: prev.clients.size });
        }
        let room = rooms.get(msg.room);
        if (!room) {
          room = { log: new Map(), clients: new Set() };
          rooms.set(msg.room, room);
        }
        const fresh = unionInto(room, msg.envelopes);
        room.clients.add(ws);
        roomOf.set(ws, msg.room);
        // The joiner gets the whole room; everyone else gets the news.
        send(ws, {
          kind: 'snapshot',
          room: msg.room,
          envelopes: [...room.log.values()].sort(compareEnvelopes),
        });
        if (fresh.length > 0) broadcast(room, { kind: 'ops', envelopes: fresh }, ws);
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
      const fresh = unionInto(room, msg.envelopes);
      if (fresh.length > 0) broadcast(room, { kind: 'ops', envelopes: fresh }, ws);
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
