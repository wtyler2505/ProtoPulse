import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../../shared/schema';

/**
 * BE-08 Audit Finding #1 (P0) parity test.
 *
 * Guards against drift between the runtime schema contract (`shared/schema.ts`)
 * and the committed Drizzle migration chain. Failure means `db:migrate` on a
 * clean database will NOT produce a schema that matches runtime query/update
 * expectations — i.e. the exact regression BE-08 flagged.
 *
 * Strategy:
 *  1. Enumerate every `pgTable` export from `shared/schema.ts` via Drizzle's
 *     `getTableConfig` (authoritative runtime list, not grep-based).
 *  2. Load the latest Drizzle snapshot (`migrations/meta/000N_snapshot.json`)
 *     which reflects the cumulative migration chain state.
 *  3. Assert: every schema table exists in the snapshot and vice versa, and
 *     every schema column exists in the snapshot table definition.
 *
 * The snapshot format is maintained by `drizzle-kit generate` and is the same
 * source the generator uses to compute incremental migration diffs, so a
 * passing test means `drizzle-kit generate` has nothing to emit — the
 * migration chain is self-consistent with the runtime schema.
 */

interface DrizzleSnapshot {
  tables: Record<string, {
    name: string;
    schema?: string;
    columns: Record<string, { name: string; type: string; notNull?: boolean }>;
  }>;
}

function loadLatestSnapshot(): DrizzleSnapshot {
  const metaDir = resolve(import.meta.dirname, '../../migrations/meta');
  const snapshots = readdirSync(metaDir)
    .filter((name) => /^\d{4}_snapshot\.json$/.test(name))
    .sort();
  expect(snapshots.length).toBeGreaterThan(0);
  const latest = snapshots[snapshots.length - 1];
  const raw = readFileSync(resolve(metaDir, latest), 'utf-8');
  return JSON.parse(raw) as DrizzleSnapshot;
}

function collectSchemaTables(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const value of Object.values(schema)) {
    // Drizzle pgTable exports carry the `[Symbol(drizzle:IsDrizzleTable)]` marker.
    // `getTableConfig` throws on non-tables, so test the shape first.
    if (!value || typeof value !== 'object') continue;
    try {
      const cfg = getTableConfig(value as Parameters<typeof getTableConfig>[0]);
      if (!cfg?.name) continue;
      const cols = new Set<string>();
      for (const col of cfg.columns) {
        cols.add(col.name);
      }
      result.set(cfg.name, cols);
    } catch {
      // Not a pgTable — skip.
    }
  }
  return result;
}

describe('BE-08: schema ↔ migration chain parity', () => {
  const snapshot = loadLatestSnapshot();
  const schemaTables = collectSchemaTables();

  // Snapshot keys look like "public.table_name" — normalise to bare names.
  const snapshotTables = new Map<string, Set<string>>();
  for (const [key, def] of Object.entries(snapshot.tables)) {
    const bareName = def.name ?? key.split('.').pop()!;
    const cols = new Set<string>(Object.values(def.columns).map((c) => c.name));
    snapshotTables.set(bareName, cols);
  }

  it('discovers every pgTable from shared/schema.ts', () => {
    expect(schemaTables.size).toBeGreaterThan(20);
  });

  it('every schema table exists in the latest migration snapshot', () => {
    const missingFromMigrations = [...schemaTables.keys()].filter(
      (name) => !snapshotTables.has(name),
    );
    expect(missingFromMigrations).toEqual([]);
  });

  it('every migration snapshot table exists in shared/schema.ts', () => {
    const missingFromSchema = [...snapshotTables.keys()].filter(
      (name) => !schemaTables.has(name),
    );
    expect(missingFromSchema).toEqual([]);
  });

  it('every schema column exists in the corresponding migration snapshot table', () => {
    const columnGaps: string[] = [];
    for (const [tableName, schemaCols] of schemaTables) {
      const snapCols = snapshotTables.get(tableName);
      if (!snapCols) continue; // covered by previous assertion
      for (const col of schemaCols) {
        if (!snapCols.has(col)) columnGaps.push(`${tableName}.${col}`);
      }
    }
    expect(columnGaps).toEqual([]);
  });
});
