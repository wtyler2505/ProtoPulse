/**
 * @protopulse/relay — the sync relay (v0.6's first server piece).
 *
 * One room = one shared op-log. Clients union envelopes by
 * (actor, lamport); materialization's total order does the rest —
 * same set, same graph, no conflict resolution in the relay at all.
 */
export {
  clientMessageSchema,
  compareEnvelopes,
  envelopeKey,
  MAX_BATCH_ENVELOPES,
  MAX_MESSAGE_BYTES,
  MAX_ROOM_CHARS,
  PROTOCOL_VERSION,
  serverMessageSchema,
  type ClientMessage,
  type ServerMessage,
} from './protocol.js';
export { createRelayServer, type RelayServer } from './server.js';
