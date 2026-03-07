/**
 * Graceful shutdown orchestrator.
 *
 * Exports a single function `performGracefulShutdown()` that can replace the
 * inline `gracefulShutdown()` in server/index.ts. Steps:
 *
 * 1. Log active connections
 * 2. Drain the job queue (cancel pending, wait for running with grace period)
 * 3. Close the collaboration WebSocket server (if registered)
 * 4. Close the HTTP server (stops accepting new connections)
 * 5. Close the database connection pool
 * 6. process.exit(0)
 *
 * Forced exit after 30s if anything hangs.
 */

import { logger } from './logger';
import { jobQueue } from './job-queue';

import type { Server } from 'http';

const FORCED_SHUTDOWN_TIMEOUT_MS = 30_000;
const JOB_QUEUE_GRACE_MS = 10_000;

/** Optional collaboration server reference — set via `registerCollaborationServer`. */
let collaborationServer: { shutdown(): void } | null = null;

/**
 * Register the collaboration WebSocket server so it can be cleanly shut down.
 * Call this from index.ts after attaching the collaboration server.
 */
export function registerCollaborationServer(server: { shutdown(): void }): void {
  collaborationServer = server;
}

/**
 * Count active socket connections on an HTTP server.
 */
function countActiveConnections(httpServer: Server): Promise<number> {
  return new Promise((resolve) => {
    httpServer.getConnections((err, count) => {
      if (err) {
        resolve(-1);
      } else {
        resolve(count);
      }
    });
  });
}

/**
 * Perform a graceful shutdown of all server components.
 *
 * @param httpServer - The Node.js HTTP server instance
 * @param signal - The signal that triggered shutdown (e.g. 'SIGTERM', 'SIGINT')
 */
export async function performGracefulShutdown(httpServer: Server, signal: string): Promise<void> {
  logger.info('Graceful shutdown initiated', { signal });

  // --- Forced exit timer (30s) ---
  const forceTimer = setTimeout(() => {
    logger.error('Forced shutdown after 30s timeout');
    process.exit(1);
  }, FORCED_SHUTDOWN_TIMEOUT_MS);

  // Don't let the timer block process exit if everything finishes first
  if (typeof forceTimer === 'object' && 'unref' in forceTimer) {
    forceTimer.unref();
  }

  try {
    // 1. Log active connections
    const activeConnections = await countActiveConnections(httpServer);
    logger.info('Shutdown: active connections', { count: activeConnections });

    // 2. Drain job queue — cancel pending, wait for running (up to 10s grace)
    logger.info('Shutdown: draining job queue');
    await jobQueue.shutdownGraceful(JOB_QUEUE_GRACE_MS);
    logger.info('Shutdown: job queue drained');

    // 3. Close collaboration WebSocket server (if registered)
    if (collaborationServer) {
      logger.info('Shutdown: closing collaboration WebSocket server');
      collaborationServer.shutdown();
      logger.info('Shutdown: collaboration server closed');
    }

    // 4. Close HTTP server (stop accepting new connections, wait for existing)
    logger.info('Shutdown: closing HTTP server');
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    logger.info('Shutdown: HTTP server closed');

    // 5. Close database pool
    logger.info('Shutdown: closing database pool');
    const { pool } = await import('./db');
    await pool.end();
    logger.info('Shutdown: database pool closed');
  } catch (err) {
    logger.error('Error during graceful shutdown', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  clearTimeout(forceTimer);
  process.exit(0);
}
