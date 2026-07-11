import { emptyGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { createDrcRunner } from './runner.js';

import type { DrcModule } from './runner.js';
import type { Deck } from '@protopulse/content/src/schemas.js';
import type { Finding } from '@protopulse/erc';

/** @protopulse/drc does not exist yet — the module loader is mocked
 *  against the pinned runDrc(graph, parts, deck) contract. */

const parts = seedPartDb();

const DECK: Deck = {
  deck: 'jlcpcb-2layer-standard',
  rev: '2026-05',
  rules: {
    min_trace_nm: 127_000,
    min_clearance_nm: 127_000,
    min_drill_nm: 300_000,
    min_annular_nm: 130_000,
    copper_to_edge_nm: 300_000,
    silk_min_width_nm: 153_000,
    mask_expansion_nm: 50_000,
  },
  classOverrides: {},
};

const FINDING: Finding = {
  severity: 'error',
  code: 'DRC-TRACE-WIDTH',
  message: 'trace narrower than deck min_trace',
  anchors: [{ kind: 'net', netId: 'na' }],
};

const deckLoader = () => Promise.resolve(DECK);

describe('createDrcRunner', () => {
  it('runs the lazy module with the deck and reports deck identity', async () => {
    let calls = 0;
    const runner = createDrcRunner(() => {
      calls++;
      return Promise.resolve<Partial<DrcModule>>({ runDrc: () => [FINDING] });
    }, deckLoader);
    const outcome = await runner.run(emptyGraph(), parts, { branch: 'main', opsVersion: 1 });
    expect(outcome).toEqual({
      ok: true,
      findings: [FINDING],
      deck: 'jlcpcb-2layer-standard',
      deckRev: '2026-05',
    });
    expect(calls).toBe(1);
  });

  it('caches per (branch, opsVersion); new heads re-run', async () => {
    let runs = 0;
    const runner = createDrcRunner(
      () =>
        Promise.resolve<Partial<DrcModule>>({
          runDrc: () => {
            runs++;
            return [];
          },
        }),
      deckLoader,
    );
    const g = emptyGraph();
    await runner.run(g, parts, { branch: 'main', opsVersion: 1 });
    await runner.run(g, parts, { branch: 'main', opsVersion: 1 });
    expect(runs).toBe(1);
    await runner.run(g, parts, { branch: 'main', opsVersion: 2 });
    expect(runs).toBe(2);
  });

  it('surfaces a missing engine as an error VALUE (panel renders it)', async () => {
    const runner = createDrcRunner(() => Promise.resolve({}), deckLoader);
    const outcome = await runner.run(emptyGraph(), parts, { branch: 'main', opsVersion: 1 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('expected failure');
    expect(outcome.error).toMatch(/not in this build/);
  });

  it('errors are never served from cache — a fixed loader retries clean', async () => {
    let attempt = 0;
    const runner = createDrcRunner(() => {
      attempt++;
      if (attempt === 1) return Promise.reject(new Error('transient load failure'));
      return Promise.resolve<Partial<DrcModule>>({ runDrc: () => [] });
    }, deckLoader);
    const g = emptyGraph();
    const first = await runner.run(g, parts, { branch: 'main', opsVersion: 7 });
    expect(first.ok).toBe(false);
    const second = await runner.run(g, parts, { branch: 'main', opsVersion: 7 });
    expect(second.ok).toBe(true);
    expect(attempt).toBe(2);
  });

  it('deck loader failures are error values too', async () => {
    const runner = createDrcRunner(
      () => Promise.resolve<Partial<DrcModule>>({ runDrc: () => [] }),
      () => Promise.reject(new Error('deck missing')),
    );
    const outcome = await runner.run(emptyGraph(), parts, { branch: 'main', opsVersion: 1 });
    expect(outcome).toEqual({ ok: false, error: 'deck missing' });
  });

  it('switching the fab deck re-runs the SAME head and reloads the deck', async () => {
    const { fabDeckFile, listFabDecks, setFabDeckFile } = await import('./runner.js');
    const original = fabDeckFile();
    const decks = listFabDecks();
    // The three verified fab decks ship in content/decks.
    expect(decks).toContain('jlcpcb-2layer-standard.json');
    expect(decks).toContain('oshpark-2layer-standard.json');
    expect(decks).toContain('pcbway-2layer-standard.json');
    expect(decks[0]).toBe('jlcpcb-2layer-standard.json'); // default first

    let runs = 0;
    let deckLoads = 0;
    const runner = createDrcRunner(
      () =>
        Promise.resolve<Partial<DrcModule>>({
          runDrc: () => {
            runs++;
            return [];
          },
        }),
      () => {
        deckLoads++;
        return Promise.resolve(DECK);
      },
    );
    try {
      const key = { branch: 'main', opsVersion: 7 };
      await runner.run(emptyGraph(), parts, key);
      await runner.run(emptyGraph(), parts, key);
      expect(runs).toBe(1); // cached
      setFabDeckFile('oshpark-2layer-standard.json');
      await runner.run(emptyGraph(), parts, key);
      expect(runs).toBe(2); // same head, different fab → different report
      expect(deckLoads).toBe(2); // and the deck reloaded
      expect(() => {
        setFabDeckFile('nope.json');
      }).toThrow('unknown fab deck');
    } finally {
      setFabDeckFile(original);
    }
  });
});
