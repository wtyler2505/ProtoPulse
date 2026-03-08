import { spawn } from 'child_process';
import crypto from 'crypto';

import { sql } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { db } from '../db';
import { logger } from '../logger';
import { asyncHandler, payloadLimit } from './utils';

import type { Express } from 'express';

/** Parse a PostgreSQL connection string into its component parts. */
function parseDatabaseUrl(url: string): {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

/** Timing-safe comparison of admin API keys using SHA-256 digests. */
function safeCompareAdminKey(provided: string, expected: string): boolean {
  if (!provided || !expected) {
    return false;
  }
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

/** Validate the X-Admin-Key header and return 403 if invalid. Returns true if authorized. */
function requireAdminKey(
  req: { headers: Record<string, string | string[] | undefined> },
  res: { status: (code: number) => { json: (body: Record<string, string>) => void } },
): boolean {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!safeCompareAdminKey(String(adminKey), expectedKey ?? '')) {
    res.status(403).json({ error: 'Forbidden: valid admin key required' });
    return false;
  }
  return true;
}

const backupRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Try again later.' },
});

const backupQuerySchema = z.object({
  format: z.enum(['sql', 'custom']).default('sql'),
  compressed: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const restoreBodySchema = z.object({
  confirm: z.literal('RESTORE'),
  sql: z.string().min(1, 'SQL dump body is required'),
});

export function registerBackupRoutes(app: Express): void {
  // --- POST /api/admin/backup — Stream a pg_dump ---

  app.post(
    '/api/admin/backup',
    backupRateLimiter,
    asyncHandler(async (req, res) => {
      if (!requireAdminKey(req, res)) {
        return;
      }

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        res.status(500).json({ error: 'DATABASE_URL is not configured' });
        return;
      }

      const queryResult = backupQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: 'Invalid query parameters', details: queryResult.error.format() });
        return;
      }
      const { format, compressed } = queryResult.data;

      const conn = parseDatabaseUrl(databaseUrl);
      const startTime = Date.now();

      logger.info('admin:backup:start', {
        format,
        compressed,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      const args: string[] = ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database];

      if (format === 'custom') {
        args.push('--format=custom');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="protopulse_backup.dump"');
      } else {
        args.push('--format=plain');
        if (compressed) {
          // pg_dump plain format does not support built-in compression;
          // pipe through gzip below.
        }
        if (!compressed) {
          res.setHeader('Content-Type', 'application/sql');
          res.setHeader('Content-Disposition', 'attachment; filename="protopulse_backup.sql"');
        }
      }

      const pgDump = spawn('pg_dump', args, {
        env: { ...process.env, PGPASSWORD: conn.password },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      pgDump.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      if (format === 'sql' && compressed) {
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', 'attachment; filename="protopulse_backup.sql.gz"');

        const gzip = spawn('gzip', ['-c'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        pgDump.stdout.pipe(gzip.stdin);
        gzip.stdout.pipe(res);

        let gzipStderr = '';
        gzip.stderr.on('data', (chunk: Buffer) => {
          gzipStderr += chunk.toString();
        });

        gzip.on('close', (gzipCode) => {
          if (gzipCode !== 0) {
            logger.error('admin:backup:gzip-error', { exitCode: gzipCode, stderr: gzipStderr });
          }
        });
      } else {
        pgDump.stdout.pipe(res);
      }

      pgDump.on('close', (code) => {
        const durationMs = Date.now() - startTime;
        if (code === 0) {
          logger.info('admin:backup:complete', { format, compressed, durationMs });
        } else {
          logger.error('admin:backup:failed', { exitCode: code, stderr, durationMs });
          // If headers haven't been sent yet, we can send an error response.
          if (!res.headersSent) {
            res.status(500).json({ error: 'pg_dump failed', details: stderr });
          }
        }
      });

      pgDump.on('error', (err) => {
        logger.error('admin:backup:spawn-error', { error: err.message });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to spawn pg_dump', details: err.message });
        }
      });
    }),
  );

  // --- POST /api/admin/restore — Execute a SQL dump ---

  app.post(
    '/api/admin/restore',
    backupRateLimiter,
    payloadLimit(100 * 1024 * 1024),
    asyncHandler(async (req, res) => {
      if (!requireAdminKey(req, res)) {
        return;
      }

      const bodyResult = restoreBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body. Requires { confirm: "RESTORE", sql: "<dump>" }',
          details: bodyResult.error.format(),
        });
        return;
      }

      const { sql: sqlDump } = bodyResult.data;

      logger.info('admin:restore:start', {
        ip: req.ip,
        sqlLength: sqlDump.length,
        timestamp: new Date().toISOString(),
      });

      // Capture pre-restore table counts for audit trail
      const preCountsResult = await db.execute<{ table_name: string; row_count: string }>(
        sql`SELECT schemaname || '.' || relname AS table_name, n_live_tup::text AS row_count
            FROM pg_stat_user_tables
            ORDER BY relname`,
      );
      const preCounts = preCountsResult.rows;

      const startTime = Date.now();

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        res.status(500).json({ error: 'DATABASE_URL is not configured' });
        return;
      }

      const conn = parseDatabaseUrl(databaseUrl);

      // Execute the SQL dump via psql for full compatibility (supports
      // multi-statement dumps, SET commands, COPY, etc.)
      const psql = spawn('psql', ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database, '-v', 'ON_ERROR_STOP=1'], {
        env: { ...process.env, PGPASSWORD: conn.password },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      psql.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      psql.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      // Write the SQL dump to psql's stdin
      psql.stdin.write(sqlDump);
      psql.stdin.end();

      await new Promise<void>((resolve, reject) => {
        psql.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`psql exited with code ${String(code)}: ${stderr}`));
          }
        });
        psql.on('error', (err) => {
          reject(new Error(`Failed to spawn psql: ${err.message}`));
        });
      });

      const durationMs = Date.now() - startTime;

      // Capture post-restore table counts
      const postCountsResult = await db.execute<{ table_name: string; row_count: string }>(
        sql`SELECT schemaname || '.' || relname AS table_name, n_live_tup::text AS row_count
            FROM pg_stat_user_tables
            ORDER BY relname`,
      );
      const postCounts = postCountsResult.rows;

      logger.info('admin:restore:complete', {
        durationMs,
        preCounts,
        postCounts,
        stdoutLength: stdout.length,
      });

      res.json({
        success: true,
        message: 'Restore completed',
        durationMs,
        tableCounts: {
          before: preCounts,
          after: postCounts,
        },
      });
    }),
  );

  // --- GET /api/admin/backup/status — Database stats ---

  app.get(
    '/api/admin/backup/status',
    backupRateLimiter,
    asyncHandler(async (req, res) => {
      if (!requireAdminKey(req, res)) {
        return;
      }

      // Database size
      const sizeResult = await db.execute<{ size: string }>(
        sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
      );

      // Table row counts
      const tableCountsResult = await db.execute<{ table_name: string; row_count: string }>(
        sql`SELECT relname AS table_name, n_live_tup::text AS row_count
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC`,
      );

      // Total row count across all tables
      const totalRows = tableCountsResult.rows.reduce((sum, row) => sum + parseInt(row.row_count, 10), 0);

      res.json({
        databaseSize: sizeResult.rows[0]?.size ?? 'unknown',
        totalRows,
        tables: tableCountsResult.rows,
        timestamp: new Date().toISOString(),
      });
    }),
  );
}
