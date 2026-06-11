import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { exportBomCsv, exportExcellon, exportGerberLayer, exportKicadNetlist, exportPickPlace } from '@protopulse/export';
import { materialize  } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';

import { FIXTURES } from './fixtures.js';

import type {DesignBundle} from '@protopulse/graph';

/**
 * Freeze fixtures into literal op-logs + expected exports. Run with
 * `npx tsx update-golden.ts` ONLY when an export format change is
 * intentional — then review the diff like the contract change it is.
 */
const GOLDEN_DATE = '2026-01-01T00:00:00.000Z';
/** content/decks/jlcpcb-2layer-standard.json min_clearance_nm — zones freeze their pours at this. */
const JLC_CLEARANCE_NM = 127_000;

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
  // Fab exports only for fixtures that carry PCB content — the
  // schematic-only fixtures keep their existing files byte-identical.
  if (graph.pcb.placements.size > 0 || graph.pcb.traces.size > 0 || graph.pcb.vias.size > 0) {
    writeFileSync(join(dir, 'expected.F.Cu.gbr'), exportGerberLayer(graph, seedPartDb(), 'F.Cu', { date: GOLDEN_DATE, pourClearanceNm: JLC_CLEARANCE_NM }));
    writeFileSync(join(dir, 'expected.B.Cu.gbr'), exportGerberLayer(graph, seedPartDb(), 'B.Cu', { date: GOLDEN_DATE, pourClearanceNm: JLC_CLEARANCE_NM }));
    writeFileSync(join(dir, 'expected.drl'), exportExcellon(graph, seedPartDb(), { date: GOLDEN_DATE }));
    writeFileSync(join(dir, 'expected.pos.csv'), exportPickPlace(graph, seedPartDb()));
  }
  const bundle: DesignBundle = {
    format: 'ppx-bundle',
    version: 1,
    designId: name,
    head: 'main',
    branches: [{ name: 'main', base: { branch: null, opCount: 0 }, ops }],
  };
  writeFileSync(join(dir, 'design.ppx.json'), JSON.stringify(bundle, null, 2) + '\n');
  console.log(`froze ${name}`);
}
