import { createRelayServer } from './server.js';
import { createFileStorage } from './storage.js';

/**
 * Dev entry point:  npm run -w @protopulse/relay dev
 * The editor's Sync panel defaults to ws://localhost:8787.
 *
 *   PORT            listen port (default 8787)
 *   PP_RELAY_TOKEN  shared secret — when set, joins must present it
 *   PP_RELAY_DATA   directory for room persistence — when set, rooms
 *                   survive relay restarts (append-only JSONL)
 */

const port = Number(process.env.PORT ?? 8787);
const token = process.env.PP_RELAY_TOKEN;
const dataDir = process.env.PP_RELAY_DATA;

createRelayServer({
  port,
  ...(token !== undefined && token !== '' ? { token } : {}),
  ...(dataDir !== undefined && dataDir !== '' ? { storage: createFileStorage(dataDir) } : {}),
})
  .then((server) => {
    const auth = token ? 'token-gated' : 'open';
    const store = dataDir ? `persisted to ${dataDir}` : 'in-memory rooms';
    console.log(`[relay] listening on ws://localhost:${String(server.port)} (${auth}, ${store} — the relay carries, it never owns)`);
  })
  .catch((err: unknown) => {
    console.error('[relay] failed to start', err);
    process.exitCode = 1;
  });
