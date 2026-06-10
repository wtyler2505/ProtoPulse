import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { exportBomCsv, exportKicadNetlist } from '@protopulse/export';
import { FIXTURES } from './fixtures.js';

/**
 * Freeze fixtures into literal op-logs + expected exports. Run with
 * `npx tsx update-golden.ts` ONLY when an export format change is
 * intentional — then review the diff like the contract change it is.
 */
const GOLDEN_DATE = '2026-01-01T00:00:00.000Z';

for (const [name, ops] of Object.entries(FIXTURES)) {
  const dir = join(import.meta.dirname, 'fixtures', name);
  mkdirSync(dir, { recursive: true });
  const { graph, warnings, violations } = materialize(ops);
  const failed = warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0 || violations.length > 0) {
    throw new Error(`${name}: fixture is broken: ${JSON.stringify([...failed, ...violations])}`);
  }
  writeFileSync(join(dir, 'ops.json'), JSON.stringify(ops, null, 2) + '\n');
  writeFileSync(join(dir, 'expected.net'), exportKicadNetlist(graph, seedPartDb(), { date: GOLDEN_DATE }));
  writeFileSync(join(dir, 'expected.bom.csv'), exportBomCsv(graph, seedPartDb()));
  console.log(`froze ${name}`);
}
