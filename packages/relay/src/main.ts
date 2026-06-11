import { createRelayServer } from './server.js';

/**
 * Dev entry point:  npm run -w @protopulse/relay dev
 * The editor's Sync panel defaults to ws://localhost:8787.
 */

const port = Number(process.env.PORT ?? 8787);

createRelayServer({ port })
  .then((server) => {
    console.log(`[relay] listening on ws://localhost:${String(server.port)} (in-memory rooms — the relay carries, it never owns)`);
  })
  .catch((err: unknown) => {
    console.error('[relay] failed to start', err);
    process.exitCode = 1;
  });
