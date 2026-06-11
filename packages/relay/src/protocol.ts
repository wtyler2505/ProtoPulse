import { opEnvelopeSchema } from '@protopulse/graph';
import { z } from 'zod';

import type { OpEnvelope } from '@protopulse/graph';

/**
 * Relay wire protocol — JSON text frames over WebSocket.
 *
 * The protocol carries op-log ENVELOPES and branch POINTERS, nothing
 * else. Envelopes are identified by (actor, lamport); the relay and
 * every client union by that key per branch, and materialization's
 * total order makes the result order-independent — same set, same
 * graph. The relay never interprets ops.
 *
 * Branch sync: a branch travels as {name, base, envelopes} where
 * envelopes are the branch's OWN ops only — the inherited prefix is
 * the base pointer, never re-carried. Two clients naming the same
 * branch with DIFFERENT bases is unsyncable; the relay keeps its
 * first-seen base and says so. v1 clients (bare `envelopes`, no
 * `branches`) keep working: their payload is the main branch.
 */

export const PROTOCOL_VERSION = 1;

/** Hard caps — a relay that trusts the network is a relay that dies. */
export const MAX_ROOM_CHARS = 128;
export const MAX_BATCH_ENVELOPES = 5_000;
export const MAX_MESSAGE_BYTES = 8 * 1024 * 1024;

const roomSchema = z.string().min(1).max(MAX_ROOM_CHARS);
const envelopesSchema = z.array(opEnvelopeSchema).max(MAX_BATCH_ENVELOPES);
const branchNameSchema = z.string().min(1).max(MAX_ROOM_CHARS);

export const branchSyncSchema = z.object({
  name: branchNameSchema,
  base: z.object({ branch: branchNameSchema.nullable(), opCount: z.number().int().nonnegative() }),
  /** The branch's OWN ops — never the inherited base prefix. */
  envelopes: envelopesSchema,
});
export type BranchSync = z.infer<typeof branchSyncSchema>;
const branchesSchema = z.array(branchSyncSchema).max(64);

export const clientMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('join'),
    v: z.literal(PROTOCOL_VERSION),
    room: roomSchema,
    /** Shared-secret auth; required when the relay was started with one. */
    token: z.string().max(256).optional(),
    /** v1 payload: the main branch's log. Branch-aware clients leave
     *  it empty and send `branches` instead. */
    envelopes: envelopesSchema,
    /** Branch-aware payload: every branch as {name, base, own ops}. */
    branches: branchesSchema.optional(),
  }),
  z.object({
    kind: z.literal('ops'),
    room: roomSchema,
    /** Target branch; absent = main (v1 clients). */
    branch: branchNameSchema.optional(),
    envelopes: envelopesSchema,
  }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('snapshot'),
    room: roomSchema,
    /** Main's log at join time, (lamport, actor)-sorted (v1 clients). */
    envelopes: envelopesSchema,
    /** Every branch the room knows, main FIRST (bases resolve in order). */
    branches: branchesSchema.optional(),
  }),
  z.object({
    kind: z.literal('ops'),
    /** Source branch; absent = main. */
    branch: branchNameSchema.optional(),
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
