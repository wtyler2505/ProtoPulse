/**
 * Reconciliation script — Phase 4 of the unified parts catalog consolidation.
 *
 * Diffs every legacy row (bomItems, componentParts, circuitInstances) against the
 * canonical `parts` / `part_stock` / `part_placements` tables. Writes a markdown report
 * to `reports/parts-drift-YYYY-MM-DD.md`.
 *
 * Run: `tsx scripts/migrations/reconcile-parts-drift.ts`
 *
 * Expected result after a successful backfill: zero drift rows.
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as schema from '@shared/schema';
import {
  parts,
  partStock,
  partPlacements,
  partLifecycle,
  bomItems,
  componentParts,
  componentLibrary,
  circuitInstances,
  componentLifecycle,
  spiceModels,
} from '@shared/schema';

type DbClient = ReturnType<typeof drizzle>;

// ---------------------------------------------------------------------------
// Drift check types
// ---------------------------------------------------------------------------

export interface DriftRow {
  legacyTable: string;
  legacyId: number;
  issue: string;
  detail: string;
}

export interface ReconcileResult {
  checkedBomItems: number;
  checkedComponentParts: number;
  checkedComponentLibrary: number;
  checkedCircuitInstances: number;
  checkedLifecycle: number;
  checkedSpice: number;
  driftRows: DriftRow[];
}

// ---------------------------------------------------------------------------
// Individual checks (exported for testing)
// ---------------------------------------------------------------------------

export async function checkBomItems(db: DbClient): Promise<{ checked: number; drifts: DriftRow[] }> {
  const rows = await db.select().from(bomItems).where(isNull(bomItems.deletedAt));
  const drifts: DriftRow[] = [];

  for (const row of rows) {
    const ref = `legacy_bom:${row.id}`;
    const canonical = await db
      .select()
      .from(parts)
      .where(eq(parts.originRef, ref))
      .limit(1);

    // Also check by (manufacturer, mpn) if no originRef match
    let partRow = canonical[0];
    if (!partRow && row.manufacturer && row.partNumber) {
      const byMpn = await db
        .select()
        .from(parts)
        .where(
          and(
            eq(parts.manufacturer, row.manufacturer),
            eq(parts.mpn, row.partNumber),
            isNull(parts.deletedAt),
          ),
        )
        .limit(1);
      partRow = byMpn[0];
    }

    if (!partRow) {
      drifts.push({
        legacyTable: 'bom_items',
        legacyId: row.id,
        issue: 'missing_part',
        detail: `No canonical part for bom_items.id=${row.id} (mpn="${row.partNumber}", mfr="${row.manufacturer}")`,
      });
      continue;
    }

    // Check that stock row exists
    const stock = await db
      .select()
      .from(partStock)
      .where(
        and(
          eq(partStock.projectId, row.projectId),
          eq(partStock.partId, partRow.id),
          isNull(partStock.deletedAt),
        ),
      )
      .limit(1);

    if (stock.length === 0) {
      drifts.push({
        legacyTable: 'bom_items',
        legacyId: row.id,
        issue: 'missing_stock',
        detail: `Part exists (${partRow.id}) but no part_stock row for project=${row.projectId}`,
      });
    }
  }

  return { checked: rows.length, drifts };
}

export async function checkComponentParts(db: DbClient): Promise<{ checked: number; drifts: DriftRow[] }> {
  const rows = await db.select().from(componentParts);
  const drifts: DriftRow[] = [];

  for (const row of rows) {
    const ref = `legacy_component_parts:${row.id}`;
    const canonical = await db
      .select({ id: parts.id })
      .from(parts)
      .where(eq(parts.originRef, ref))
      .limit(1);

    if (canonical.length === 0) {
      drifts.push({
        legacyTable: 'component_parts',
        legacyId: row.id,
        issue: 'missing_part',
        detail: `No canonical part for component_parts.id=${row.id} (nodeId="${row.nodeId}")`,
      });
    }
  }

  return { checked: rows.length, drifts };
}

export async function checkComponentLibrary(db: DbClient): Promise<{ checked: number; drifts: DriftRow[] }> {
  const rows = await db.select().from(componentLibrary);
  const drifts: DriftRow[] = [];

  for (const row of rows) {
    const ref = `library:${row.id}`;
    const canonical = await db
      .select({ id: parts.id })
      .from(parts)
      .where(eq(parts.originRef, ref))
      .limit(1);

    if (canonical.length === 0) {
      drifts.push({
        legacyTable: 'component_library',
        legacyId: row.id,
        issue: 'missing_part',
        detail: `No canonical part for component_library.id=${row.id} (title="${row.title}")`,
      });
    }
  }

  return { checked: rows.length, drifts };
}

export async function checkCircuitInstances(db: DbClient): Promise<{ checked: number; drifts: DriftRow[] }> {
  const rows = await db
    .select()
    .from(circuitInstances)
    .where(sql`${circuitInstances.partId} IS NOT NULL`);
  const drifts: DriftRow[] = [];

  for (const row of rows) {
    if (!row.partId) { continue; }

    const canonicalPart = await db
      .select({ id: parts.id })
      .from(parts)
      .where(eq(parts.originRef, `legacy_component_parts:${row.partId}`))
      .limit(1);

    if (canonicalPart.length === 0) {
      drifts.push({
        legacyTable: 'circuit_instances',
        legacyId: row.id,
        issue: 'missing_part',
        detail: `No canonical part for circuit_instances.partId=${row.partId}`,
      });
      continue;
    }

    const placement = await db
      .select({ id: partPlacements.id })
      .from(partPlacements)
      .where(
        and(
          eq(partPlacements.partId, canonicalPart[0].id),
          eq(partPlacements.containerId, row.circuitId),
          eq(partPlacements.referenceDesignator, row.referenceDesignator),
          isNull(partPlacements.deletedAt),
        ),
      )
      .limit(1);

    if (placement.length === 0) {
      drifts.push({
        legacyTable: 'circuit_instances',
        legacyId: row.id,
        issue: 'missing_placement',
        detail: `Part exists but no placement for instance.id=${row.id} (refdes="${row.referenceDesignator}", circuit=${row.circuitId})`,
      });
    }
  }

  return { checked: rows.length, drifts };
}

export async function checkLifecycle(db: DbClient): Promise<{ checked: number; drifts: DriftRow[] }> {
  const rows = await db.select().from(componentLifecycle);
  const drifts: DriftRow[] = [];

  for (const row of rows) {
    // Find canonical by (manufacturer, mpn) or mpn alone
    let found = false;
    if (row.manufacturer && row.partNumber) {
      const match = await db
        .select({ id: parts.id })
        .from(parts)
        .where(
          and(
            eq(parts.manufacturer, row.manufacturer),
            eq(parts.mpn, row.partNumber),
            isNull(parts.deletedAt),
          ),
        )
        .limit(1);
      if (match.length > 0) {
        const lc = await db
          .select({ id: partLifecycle.id })
          .from(partLifecycle)
          .where(eq(partLifecycle.partId, match[0].id))
          .limit(1);
        found = lc.length > 0;
      }
    }

    if (!found) {
      drifts.push({
        legacyTable: 'component_lifecycle',
        legacyId: row.id,
        issue: 'missing_lifecycle',
        detail: `No canonical lifecycle for partNumber="${row.partNumber}" (mfr="${row.manufacturer ?? 'null'}")`,
      });
    }
  }

  return { checked: rows.length, drifts };
}

export async function checkSpiceModels(db: DbClient): Promise<{ checked: number; drifts: DriftRow[] }> {
  const rows = await db.select().from(spiceModels);
  const drifts: DriftRow[] = [];

  for (const row of rows) {
    const match = await db
      .select({ id: parts.id })
      .from(parts)
      .where(eq(parts.originRef, `legacy_spice_stub:${row.id}`))
      .limit(1);

    // Also try title match
    let found = match.length > 0;
    if (!found) {
      const titleMatch = await db
        .select({ id: parts.id })
        .from(parts)
        .where(
          and(
            sql`lower(${parts.title}) LIKE ${`%${row.name.toLowerCase()}%`}`,
            isNull(parts.deletedAt),
          ),
        )
        .limit(1);
      found = titleMatch.length > 0;
    }

    if (!found) {
      drifts.push({
        legacyTable: 'spice_models',
        legacyId: row.id,
        issue: 'missing_part',
        detail: `No canonical part for SPICE model "${row.name}" (type=${row.modelType})`,
      });
    }
  }

  return { checked: rows.length, drifts };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runReconciliation(db: DbClient): Promise<ReconcileResult> {
  console.log('Checking bom_items...');
  const bomCheck = await checkBomItems(db);
  console.log(`  Checked ${bomCheck.checked} rows, ${bomCheck.drifts.length} drift(s)`);

  console.log('Checking component_parts...');
  const cpCheck = await checkComponentParts(db);
  console.log(`  Checked ${cpCheck.checked} rows, ${cpCheck.drifts.length} drift(s)`);

  console.log('Checking component_library...');
  const clCheck = await checkComponentLibrary(db);
  console.log(`  Checked ${clCheck.checked} rows, ${clCheck.drifts.length} drift(s)`);

  console.log('Checking circuit_instances...');
  const ciCheck = await checkCircuitInstances(db);
  console.log(`  Checked ${ciCheck.checked} rows, ${ciCheck.drifts.length} drift(s)`);

  console.log('Checking component_lifecycle...');
  const lcCheck = await checkLifecycle(db);
  console.log(`  Checked ${lcCheck.checked} rows, ${lcCheck.drifts.length} drift(s)`);

  console.log('Checking spice_models...');
  const spCheck = await checkSpiceModels(db);
  console.log(`  Checked ${spCheck.checked} rows, ${spCheck.drifts.length} drift(s)`);

  return {
    checkedBomItems: bomCheck.checked,
    checkedComponentParts: cpCheck.checked,
    checkedComponentLibrary: clCheck.checked,
    checkedCircuitInstances: ciCheck.checked,
    checkedLifecycle: lcCheck.checked,
    checkedSpice: spCheck.checked,
    driftRows: [
      ...bomCheck.drifts,
      ...cpCheck.drifts,
      ...clCheck.drifts,
      ...ciCheck.drifts,
      ...lcCheck.drifts,
      ...spCheck.drifts,
    ],
  };
}

function buildReport(result: ReconcileResult): string {
  const date = new Date().toISOString().split('T')[0];
  const totalChecked =
    result.checkedBomItems +
    result.checkedComponentParts +
    result.checkedComponentLibrary +
    result.checkedCircuitInstances +
    result.checkedLifecycle +
    result.checkedSpice;

  const lines: string[] = [
    `# Parts Catalog Drift Report — ${date}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total legacy rows checked | ${totalChecked} |`,
    `| Drift rows | ${result.driftRows.length} |`,
    `| bom_items checked | ${result.checkedBomItems} |`,
    `| component_parts checked | ${result.checkedComponentParts} |`,
    `| component_library checked | ${result.checkedComponentLibrary} |`,
    `| circuit_instances checked | ${result.checkedCircuitInstances} |`,
    `| component_lifecycle checked | ${result.checkedLifecycle} |`,
    `| spice_models checked | ${result.checkedSpice} |`,
    '',
  ];

  if (result.driftRows.length === 0) {
    lines.push('**Result: ZERO DRIFT** — all legacy rows have corresponding canonical rows.');
  } else {
    lines.push(`**Result: ${result.driftRows.length} DRIFT ROW(S) FOUND**`);
    lines.push('');
    lines.push('## Drift Details');
    lines.push('');
    lines.push('| Legacy Table | ID | Issue | Detail |');
    lines.push('|---|---|---|---|');
    for (const d of result.driftRows) {
      lines.push(`| ${d.legacyTable} | ${d.legacyId} | ${d.issue} | ${d.detail} |`);
    }
  }

  lines.push('');
  lines.push(`Generated by \`scripts/migrations/reconcile-parts-drift.ts\` at ${new Date().toISOString()}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL must be set.');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  const db = drizzle(pool, { schema });

  console.log('Parts catalog drift reconciliation — Phase 4');
  console.log('=============================================\n');

  try {
    const result = await runReconciliation(db);
    const report = buildReport(result);

    const reportsDir = resolve(import.meta.dirname ?? '.', '../../reports');
    await mkdir(reportsDir, { recursive: true });
    const date = new Date().toISOString().split('T')[0];
    const reportPath = resolve(reportsDir, `parts-drift-${date}.md`);
    await writeFile(reportPath, report, 'utf-8');

    console.log(`\nReport written to: ${reportPath}`);
    console.log(`\nDrift rows: ${result.driftRows.length}`);

    if (result.driftRows.length > 0) {
      console.log('\n⚠  Drift detected. Review the report.');
      process.exit(1);
    } else {
      console.log('\n✓  Zero drift — canonical tables are in sync with legacy.');
    }
  } finally {
    await pool.end();
  }
}

const isDirectRun = process.argv[1]?.endsWith('reconcile-parts-drift.ts') ||
  process.argv[1]?.endsWith('reconcile-parts-drift.js');
if (isDirectRun) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
