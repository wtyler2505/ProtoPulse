/**
 * Migration drift regression gate (BE-08 P0 fix).
 *
 * Applies the full migration chain against a scratch PostgreSQL database,
 * introspects information_schema, and asserts parity with the runtime
 * Drizzle schema definitions in shared/schema.ts.
 *
 * Runs only when MIGRATION_DRIFT_DB_URL is set — in CI or when an
 * operator has provisioned a scratch database. Otherwise the suite
 * performs static checks that do not require a database.
 *
 * To run the full database-backed suite locally:
 *   sudo -u postgres bash -c "createuser -s $USER 2>/dev/null; \
 *                              createdb drizzle_migration_test -O $USER"
 *   MIGRATION_DRIFT_DB_URL=postgresql://$USER@localhost:5432/drizzle_migration_test \
 *     npx vitest run server/__tests__/migration-drift.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../../shared/schema';

const SCRATCH_DB_URL = process.env.MIGRATION_DRIFT_DB_URL;
const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../migrations');

// --- Static helpers ---------------------------------------------------------

function getSchemaTables(): Map<string, ReturnType<typeof getTableConfig>> {
  const tables = new Map<string, ReturnType<typeof getTableConfig>>();
  for (const exported of Object.values(schema as Record<string, unknown>)) {
    // Drizzle pgTable objects expose Symbol.for('drizzle:Name')
    if (
      exported &&
      typeof exported === 'object' &&
      Symbol.for('drizzle:Name') in (exported as object)
    ) {
      try {
        const cfg = getTableConfig(exported as Parameters<typeof getTableConfig>[0]);
        tables.set(cfg.name, cfg);
      } catch {
        // Not a pgTable (e.g. a view or other construct) — skip.
      }
    }
  }
  return tables;
}

function readMigrationSql(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
  return files
    .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf-8'))
    .join('\n');
}

// --- Static-only assertions (always run) ------------------------------------

describe('migration-drift (static)', () => {
  const schemaTables = getSchemaTables();

  it('every pgTable in shared/schema.ts appears as a CREATE TABLE in some migration', () => {
    const allSql = readMigrationSql();
    const missing: string[] = [];
    for (const tableName of schemaTables.keys()) {
      const pattern = new RegExp(
        `CREATE TABLE(?:\\s+IF NOT EXISTS)?\\s+"${tableName}"`,
        'i',
      );
      if (!pattern.test(allSql)) missing.push(tableName);
    }
    expect(missing, `Tables in schema.ts but not in any migration: ${missing.join(', ')}`).toEqual([]);
  });

  it('migration chain has no RENAME TABLE or RENAME COLUMN (indicates schema/snapshot drift)', () => {
    // A RENAME in the generated catch-up migration would mean drizzle-kit
    // silently treated a newly-added field as a rename of an existing one —
    // which corrupts data in any DB that ran an earlier snapshot.
    const latest = readFileSync(
      resolve(MIGRATIONS_DIR, '0003_catch_up_schema.sql'),
      'utf-8',
    );
    expect(latest).not.toMatch(/\bRENAME COLUMN\b/i);
    expect(latest).not.toMatch(/\bRENAME TABLE\b/i);
  });

  it('journal lists all migration files exactly once, in order', () => {
    const journal = JSON.parse(
      readFileSync(resolve(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf-8'),
    ) as { entries: Array<{ idx: number; tag: string }> };
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{4}_.+\.sql$/.test(f))
      .sort();
    expect(journal.entries.length).toBe(files.length);
    journal.entries.forEach((entry, i) => {
      expect(entry.idx).toBe(i);
      expect(files[i].startsWith(entry.tag)).toBe(true);
    });
  });

  it('reports expected table count for visibility (fails loudly on drift)', () => {
    // This is intentionally a snapshot-style assertion — if schema.ts gains
    // or drops a table, the number updates here and the test fails until
    // a new migration is added.
    expect(schemaTables.size).toBe(46);
  });
});

// --- DB-backed parity (runs when MIGRATION_DRIFT_DB_URL set) ----------------

const describeDb = SCRATCH_DB_URL ? describe : describe.skip;

describeDb('migration-drift (database parity)', () => {
  let client: pg.Client;
  const schemaTables = getSchemaTables();

  beforeAll(async () => {
    client = new pg.Client({ connectionString: SCRATCH_DB_URL });
    await client.connect();

    // Reset public schema to ensure clean slate.
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');

    // Apply every migration SQL file in order, statement-by-statement.
    // Drizzle splits multi-statement files with "--> statement-breakpoint".
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{4}_.+\.sql$/.test(f))
      .sort();
    for (const file of files) {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const statement of statements) {
        try {
          await client.query(statement);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Migration ${file} failed on statement:\n${statement}\n\nError: ${msg}`);
        }
      }
    }
  }, 120_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  it('every schema.ts table exists in the database', async () => {
    const result = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const dbTables = new Set(result.rows.map((r) => r.table_name));
    const missing = [...schemaTables.keys()].filter((t) => !dbTables.has(t));
    expect(missing, `Tables declared in schema.ts but missing from DB: ${missing.join(', ')}`).toEqual([]);
  });

  it('every column in schema.ts exists in the database with matching nullability', async () => {
    const result = await client.query<{
      table_name: string;
      column_name: string;
      is_nullable: string;
    }>(
      `SELECT table_name, column_name, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'`,
    );
    const dbCols = new Map<string, { nullable: boolean }>();
    for (const row of result.rows) {
      dbCols.set(`${row.table_name}.${row.column_name}`, {
        nullable: row.is_nullable === 'YES',
      });
    }

    const missing: string[] = [];
    const nullabilityMismatches: string[] = [];
    for (const [tableName, cfg] of schemaTables) {
      for (const col of cfg.columns) {
        const key = `${tableName}.${col.name}`;
        const dbCol = dbCols.get(key);
        if (!dbCol) {
          missing.push(key);
          continue;
        }
        // Schema column "notNull" ⇒ DB must be NOT NULL.
        // Do not flag extra NOT NULL constraints in DB not marked in schema.
        if (col.notNull && dbCol.nullable) {
          nullabilityMismatches.push(`${key} (schema=NOT NULL, db=NULL)`);
        }
      }
    }
    expect(missing, `Columns in schema.ts but not in DB: ${missing.join(', ')}`).toEqual([]);
    expect(
      nullabilityMismatches,
      `Nullability mismatches: ${nullabilityMismatches.join(', ')}`,
    ).toEqual([]);
  });
});
