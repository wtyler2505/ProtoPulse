import { opEnvelopeSchema } from '@protopulse/graph';
import { z } from 'zod';

import type { OpEnvelope } from '@protopulse/graph';

/**
 * Relay wire protocol — JSON text frames over WebSocket.
 *
 * The protocol carries op-log ENVELOPES and nothing else. Envelopes are
 * identified by (actor, lamport); the relay and every client union by
 * that key, and materialization's (lamport, actorId) total order makes
 * the result order-independent — same set, same graph. The relay never
 * interprets ops.
 *
 * v1 scope, stated plainly: one room syncs ONE branch's log (clients
 * send their main branch). The room log lives in relay memory only —
 * clients keep their own persistence; the relay carries, it never owns.
 */

export const PROTOCOL_VERSION = 1;

/** Hard caps — a relay that trusts the network is a relay that dies. */
export const MAX_ROOM_CHARS = 128;
export const MAX_BATCH_ENVELOPES = 5_000;
export const MAX_MESSAGE_BYTES = 8 * 1024 * 1024;

const roomSchema = z.string().min(1).max(MAX_ROOM_CHARS);
const envelopesSchema = z.array(opEnvelopeSchema).max(MAX_BATCH_ENVELOPES);

export const clientMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('join'),
    v: z.literal(PROTOCOL_VERSION),
    room: roomSchema,
    /** The client's current log — the relay unions it into the room. */
    envelopes: envelopesSchema,
  }),
  z.object({
    kind: z.literal('ops'),
    room: roomSchema,
    envelopes: envelopesSchema,
  }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('snapshot'),
    room: roomSchema,
    /** The full room log at join time, (lamport, actor)-sorted. */
    envelopes: envelopesSchema,
  }),
  z.object({
    kind: z.literal('ops'),
    envelopes: envelopesSchema,
  }),
  z.object({
    kind: z.literal('peers'),
    count: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('error'),
    message: z.string(),
  }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

/** Identity key — per-actor lamports are monotonic, so this is unique. */
export function envelopeKey(env: OpEnvelope): string {
  return `${env.actor}:${String(env.lamport)}`;
}

/** The materialization order, for snapshot determinism. */
export function compareEnvelopes(a: OpEnvelope, b: OpEnvelope): number {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  return a.actor < b.actor ? -1 : a.actor > b.actor ? 1 : 0;
}
