import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { runErc } from '@protopulse/erc';
import {
  exportBomCsv,
  exportExcellon,
  exportGerberLayer,
  exportKicadNetlist,
  exportPickPlace,
} from '@protopulse/export';
import { materialize, opEnvelopeSchema } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Golden-file tests: known op-logs → known exports, byte-exact.
 * A diff here is a contract change — re-freeze deliberately via
 * update-golden.ts and review it.
 */
const GOLDEN_DATE = '2026-01-01T00:00:00.000Z';
const fixturesDir = join(import.meta.dirname, 'fixtures');
const names = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

describe('golden exports', () => {
  it('has the four fixtures', () => {
    expect(names).toEqual(['led-resistor', 'probe-input-protection', 'routed-led', 'traffic-light-555']);
  });

  for (const name of names) {
    describe(name, () => {
      const dir = join(fixturesDir, name);
      const ops = z.array(opEnvelopeSchema).parse(JSON.parse(readFileSync(join(dir, 'ops.json'), 'utf8')));
      const result = materialize(ops);

      it('replays without failures or invariant violations', () => {
        expect(result.warnings.filter((w) => w.kind === 'apply_failed')).toEqual([]);
        expect(result.violations).toEqual([]);
      });

      it('is ERC-clean (no errors)', () => {
        const findings = runErc(result.graph, seedPartDb());
        expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
      });

      it('KiCad netlist matches byte-exactly', () => {
        const expected = readFileSync(join(dir, 'expected.net'), 'utf8');
        expect(exportKicadNetlist(result.graph, seedPartDb(), { date: GOLDEN_DATE })).toBe(expected);
      });

      it('BOM CSV matches byte-exactly', () => {
        const expected = readFileSync(join(dir, 'expected.bom.csv'), 'utf8');
        expect(exportBomCsv(result.graph, seedPartDb())).toBe(expected);
      });

      // Fab exports exist only for fixtures with PCB content.
      if (existsSync(join(dir, 'expected.F.Cu.gbr'))) {
        it('F.Cu Gerber matches byte-exactly', () => {
          const expected = readFileSync(join(dir, 'expected.F.Cu.gbr'), 'utf8');
          expect(exportGerberLayer(result.graph, seedPartDb(), 'F.Cu', { date: GOLDEN_DATE })).toBe(expected);
        });

        it('B.Cu Gerber matches byte-exactly', () => {
          const expected = readFileSync(join(dir, 'expected.B.Cu.gbr'), 'utf8');
          expect(exportGerberLayer(result.graph, seedPartDb(), 'B.Cu', { date: GOLDEN_DATE })).toBe(expected);
        });

        it('Excellon drill file matches byte-exactly', () => {
          const expected = readFileSync(join(dir, 'expected.drl'), 'utf8');
          expect(exportExcellon(result.graph, seedPartDb(), { date: GOLDEN_DATE })).toBe(expected);
        });

        it('pick-and-place CSV matches byte-exactly', () => {
          const expected = readFileSync(join(dir, 'expected.pos.csv'), 'utf8');
          expect(exportPickPlace(result.graph, seedPartDb())).toBe(expected);
        });
      }
    });
  }
});
