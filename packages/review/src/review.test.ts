import { readFileSync } from 'node:fs';

import { ERC_CODES } from '@protopulse/erc';
import { materialize, opEnvelopeSchema } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { conceptForReview, REV_CODES } from './codes.js';
import { diffReports } from './diff.js';
import { runReview } from './run.js';

import type { ReviewReport } from './report.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';

const parts = seedPartDb();
const DATE = '2026-06-10';

function graphOf(ops: OpBody[]): DesignGraph {
  const result = materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op })));
  const failed = result.warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0) throw new Error(failed.map((w) => w.message).join('; '));
  return result.graph;
}

function review(ops: OpBody[]): ReviewReport {
  return runReview(graphOf(ops), parts, { date: DATE });
}

function codesOf(ops: OpBody[]): string[] {
  return review(ops).findings.map((f) => f.code);
}

/** NE555 with VCC/GND rails wired and inputs tied — ERC-clean baseline. */
function wired555(): OpBody[] {
  return [
    { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
    { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1 },
    { kind: 'add_component', id: 'gnd', ref: 'PWR2', partId: 'core:pwr-gnd', partRev: 1 },
    { kind: 'connect', port: 'u1:8', newNetId: 'nvcc' },
    { kind: 'connect', port: 'vcc:1', netId: 'nvcc' },
    { kind: 'connect', port: 'u1:1', newNetId: 'ngnd' },
    { kind: 'connect', port: 'gnd:1', netId: 'ngnd' },
    { kind: 'connect', port: 'u1:2', netId: 'ngnd' },
    { kind: 'connect', port: 'u1:6', netId: 'ngnd' },
    { kind: 'connect', port: 'u1:4', netId: 'nvcc' },
  ];
}

/** wired555 plus a 100nF between the rails — decoupling satisfied. */
function decoupled555(): OpBody[] {
  return [
    ...wired555(),
    { kind: 'add_component', id: 'c1', ref: 'C1', partId: 'core:capacitor', partRev: 1, value: '100nF' },
    { kind: 'connect', port: 'c1:1', netId: 'nvcc' },
    { kind: 'connect', port: 'c1:2', netId: 'ngnd' },
  ];
}

describe('check: erc (embedded)', () => {
  it('embeds ERC findings with check "erc" and unchanged codes', () => {
    const report = review([{ kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 }]);
    const erc = report.findings.filter((f) => f.check === 'erc');
    expect(erc.length).toBeGreaterThan(0);
    expect(erc.map((f) => f.code)).toContain('ERC-FLOATING-INPUT');
    expect(erc.every((f) => f.code.startsWith('ERC-'))).toBe(true);
  });

  it('counts embedded ERC findings in the report totals', () => {
    const report = review([{ kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 }]);
    expect(report.counts.error).toBeGreaterThan(0);
  });
});

describe('check: decoupling', () => {
  it('warns on an IC with no decoupling capacitor', () => {
    const finding = review(wired555()).findings.find((f) => f.code === 'REV-DECOUPLING-MISSING');
    expect(finding).toBeDefined();
    expect(finding?.check).toBe('decoupling');
    expect(finding?.severity).toBe('warn');
  });

  it('clears when a cap bridges the IC supply net to ground', () => {
    expect(codesOf(decoupled555())).not.toContain('REV-DECOUPLING-MISSING');
  });

  it('a cap to a non-ground net does not count as decoupling', () => {
    const found = codesOf([
      ...wired555(),
      { kind: 'add_component', id: 'c1', ref: 'C1', partId: 'core:capacitor', partRev: 1 },
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'c1:1', netId: 'nvcc' },
      { kind: 'connect', port: 'c1:2', newNetId: 'nsig' },
      { kind: 'connect', port: 'r1:1', netId: 'nsig' },
    ]);
    expect(found).toContain('REV-DECOUPLING-MISSING');
  });

  it('a DNP cap does not count as decoupling', () => {
    const found = codesOf([
      ...decoupled555(),
      { kind: 'set_component_props', id: 'c1', props: { dnp: true } },
    ]);
    expect(found).toContain('REV-DECOUPLING-MISSING');
  });

  it('a DNP IC is not asked for decoupling', () => {
    const found = codesOf([
      ...wired555(),
      { kind: 'set_component_props', id: 'u1', props: { dnp: true } },
    ]);
    expect(found).not.toContain('REV-DECOUPLING-MISSING');
  });

  it('the executable fix re-runs clean', () => {
    const base = wired555();
    const finding = review(base).findings.find((f) => f.code === 'REV-DECOUPLING-MISSING');
    expect(finding?.fix).toBeDefined();
    const fixed = runReview(graphOf([...base, ...(finding?.fix ?? [])]), parts, { date: DATE });
    expect(fixed.findings.map((f) => f.code)).not.toContain('REV-DECOUPLING-MISSING');
  });

  it('the fix is a batch adding a 100nF cap with a fresh ref and colon-free id', () => {
    const finding = review(wired555()).findings.find((f) => f.code === 'REV-DECOUPLING-MISSING');
    const batch = finding?.fix?.[0];
    expect(batch?.kind).toBe('batch');
    if (batch?.kind !== 'batch') throw new Error('expected batch fix');
    const add = batch.ops[0];
    if (add?.kind !== 'add_component') throw new Error('expected add_component first');
    expect(add.partId).toBe('core:capacitor');
    expect(add.value).toBe('100nF');
    expect(add.ref).toBe('C1');
    expect(add.id).not.toContain(':');
  });

  it('skips the fix when no supply or ground net is identifiable', () => {
    // IC with only its output wired — no power nets anywhere.
    const finding = review([
      { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'u1:3', newNetId: 'nout' },
      { kind: 'connect', port: 'r1:1', netId: 'nout' },
    ]).findings.find((f) => f.code === 'REV-DECOUPLING-MISSING');
    expect(finding).toBeDefined();
    expect(finding?.fix).toBeUndefined();
  });
});

describe('check: power-tree', () => {
  it('reports a per-rail summary of declared draws', () => {
    const summary = review([
      ...wired555(),
      { kind: 'rename_net', netId: 'nvcc', name: 'VCC' },
    ]).findings.find((f) => f.code === 'REV-POWER-SUMMARY');
    expect(summary).toBeDefined();
    expect(summary?.severity).toBe('info');
    expect(summary?.check).toBe('power-tree');
    expect(summary?.message).toBe('VCC: 10mA declared'); // NE555 declares 10mA
  });

  it('ground-flavored nets get no rail summary', () => {
    const summaries = review(wired555()).findings.filter((f) => f.code === 'REV-POWER-SUMMARY');
    expect(summaries).toHaveLength(1); // nvcc only, never ngnd
  });

  it('DNP components are excluded from the rail sum', () => {
    const base: OpBody[] = [
      { kind: 'add_component', id: 'bat', ref: 'BT1', partId: 'core:battery', partRev: 1 },
      { kind: 'add_component', id: 'led', ref: 'D1', partId: 'core:led', partRev: 1 },
      { kind: 'connect', port: 'bat:+', newNetId: 'n1' },
      { kind: 'connect', port: 'led:A', netId: 'n1' },
      { kind: 'connect', port: 'led:K', newNetId: 'n2' },
      { kind: 'connect', port: 'bat:-', netId: 'n2' },
      { kind: 'rename_net', netId: 'n1', name: 'VLED' },
    ];
    const before = review(base).findings.find((f) => f.message.startsWith('VLED:'));
    expect(before?.message).toBe('VLED: 20mA declared');
    const after = review([...base, { kind: 'set_component_props', id: 'led', props: { dnp: true } }])
      .findings.find((f) => f.message.startsWith('VLED:'));
    expect(after?.message).toBe('VLED: 0mA declared');
  });

  it('never emits REV-RAIL-OVERBUDGET — ERC-CURRENT-BUDGET already covers exceeded rail constraints, exactly once', () => {
    const found = codesOf([
      ...wired555(),
      { kind: 'add_constraint', id: 'k1', body: { kind: 'current_max', netId: 'nvcc', amps: 0.005 }, rationale: 'rail budget' },
    ]);
    expect(found).not.toContain('REV-RAIL-OVERBUDGET');
    expect(found.filter((c) => c === 'ERC-CURRENT-BUDGET')).toHaveLength(1);
  });
});

describe('check: unverified-parts', () => {
  it('warns on an unverified diode (load-bearing class)', () => {
    const finding = review([
      { kind: 'add_component', id: 'd1', ref: 'D1', partId: 'core:1n4148', partRev: 1 },
    ]).findings.find((f) => f.code === 'REV-UNVERIFIED-PART');
    expect(finding).toBeDefined();
    expect(finding?.check).toBe('unverified-parts');
    expect(finding?.message).toContain('load-bearing');
  });

  it('warns on an unverified transistor', () => {
    expect(codesOf([{ kind: 'add_component', id: 'q1', ref: 'Q1', partId: 'core:2n3904', partRev: 1 }]))
      .toContain('REV-UNVERIFIED-PART');
  });

  it('warns on an unverified part with power pins (battery)', () => {
    expect(codesOf([{ kind: 'add_component', id: 'b1', ref: 'BT1', partId: 'core:battery', partRev: 1 }]))
      .toContain('REV-UNVERIFIED-PART');
  });

  it('stays quiet on unverified passives without power pins', () => {
    expect(codesOf([{ kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 }]))
      .not.toContain('REV-UNVERIFIED-PART');
  });

  it('stays quiet on verified parts (NE555, BAT54S)', () => {
    const found = codesOf([
      { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
      { kind: 'add_component', id: 'd1', ref: 'D1', partId: 'core:bat54s', partRev: 1 },
    ]);
    expect(found).not.toContain('REV-UNVERIFIED-PART');
  });
});

describe('check: single-pin-ics', () => {
  it('errors on an IC with zero nets', () => {
    const finding = review([
      { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
    ]).findings.find((f) => f.code === 'REV-IC-UNWIRED');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('error');
    expect(finding?.check).toBe('single-pin-ics');
  });

  it('errors on an IC with a single net', () => {
    const found = codesOf([
      { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'u1:3', newNetId: 'n1' },
      { kind: 'connect', port: 'r1:1', netId: 'n1' },
    ]);
    expect(found).toContain('REV-IC-UNWIRED');
  });

  it('clears at two or more nets', () => {
    expect(codesOf(wired555())).not.toContain('REV-IC-UNWIRED');
  });

  it('does not apply to non-IC components', () => {
    const found = codesOf([
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'r1:1', newNetId: 'n1' },
    ]);
    expect(found).not.toContain('REV-IC-UNWIRED');
  });
});

describe('check: dnp-power', () => {
  it('errors when the only power source on a supply-feeding net is DNP — a hole ERC cannot see', () => {
    const found = codesOf([
      ...wired555(),
      { kind: 'set_component_props', id: 'vcc', props: { dnp: true } },
    ]);
    expect(found).toContain('REV-DNP-RAIL');
    // ERC still sees a power_out pin on the net, so it stays quiet:
    expect(found).not.toContain('ERC-POWER-UNSOURCED');
  });

  it('clears when the source is populated', () => {
    expect(codesOf(wired555())).not.toContain('REV-DNP-RAIL');
  });

  it('clears when any non-DNP source remains on the net', () => {
    const found = codesOf([
      ...wired555(),
      { kind: 'add_component', id: 'vcc2', ref: 'PWR3', partId: 'core:pwr-vcc', partRev: 1 },
      { kind: 'connect', port: 'vcc2:1', netId: 'nvcc' },
      { kind: 'set_component_props', id: 'vcc', props: { dnp: true } },
    ]);
    expect(found).not.toContain('REV-DNP-RAIL');
  });

  it('ignores nets that feed no supply pins', () => {
    const found = codesOf([
      { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1 },
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'vcc:1', newNetId: 'n1' },
      { kind: 'connect', port: 'r1:1', netId: 'n1' },
      { kind: 'set_component_props', id: 'vcc', props: { dnp: true } },
    ]);
    expect(found).not.toContain('REV-DNP-RAIL');
  });
});

describe('review decks + community checks', () => {
  it('a deck disables checks and overrides severities; the report pins deck+rev', () => {
    // wired555 has unverified parts (info) — disable that check, and
    // force decoupling findings (warn) up to error.
    const deck = {
      deck: 'strict-house',
      rev: '7',
      checks: {
        'unverified-parts': { enabled: false },
        decoupling: { severity: 'error' as const },
      },
    };
    const base = runReview(graphOf(wired555()), parts, { date: DATE });
    const decked = runReview(graphOf(wired555()), parts, { date: DATE, deck });

    expect(decked.deck).toBe('strict-house');
    expect(decked.deckRev).toBe('7');
    expect(base.deck).toBe('builtin');
    expect(base.findings.some((f) => f.check === 'unverified-parts')).toBe(true);
    expect(decked.findings.some((f) => f.check === 'unverified-parts')).toBe(false);
    const decoupling = decked.findings.filter((f) => f.check === 'decoupling');
    expect(decoupling.length).toBeGreaterThan(0);
    expect(decoupling.every((f) => f.severity === 'error')).toBe(true);
  });

  it('community checks join the run as first-class citizens the deck can configure', () => {
    const noElectrolytics = {
      id: 'no-electrolytics',
      run: (graph: Parameters<typeof runReview>[0]) =>
        [...graph.components.values()]
          .filter((c) => c.partId === 'core:capacitor-electrolytic')
          .map((c) => ({
            severity: 'warn' as const,
            code: 'COMMUNITY-NO-ELECTROLYTICS',
            message: `${c.ref} is electrolytic — this deck forbids them`,
            anchors: [{ kind: 'component' as const, componentId: c.id }],
          })),
    };
    const ops = [
      ...wired555(),
      { kind: 'add_component', id: 'ce', ref: 'C9', partId: 'core:capacitor-electrolytic', partRev: 1 } as const,
    ];
    const report = runReview(graphOf(ops), parts, { date: DATE, extraChecks: [noElectrolytics] });
    const hit = report.findings.find((f) => f.code === 'COMMUNITY-NO-ELECTROLYTICS');
    expect(hit).toMatchObject({ check: 'no-electrolytics', severity: 'warn' });

    // The deck governs extras exactly like built-ins.
    const silenced = runReview(graphOf(ops), parts, {
      date: DATE,
      extraChecks: [noElectrolytics],
      deck: { deck: 'd', rev: '1', checks: { 'no-electrolytics': { enabled: false } } },
    });
    expect(silenced.findings.some((f) => f.check === 'no-electrolytics')).toBe(false);
  });
});

describe('report shape', () => {
  it('carries tool, deckRev, the injected date, designId and branch', () => {
    const report = runReview(graphOf(wired555()), parts, { date: DATE, designId: 'd-1', branch: 'main' });
    expect(report.tool).toBe('protopulse-review');
    expect(report.deckRev.length).toBeGreaterThan(0);
    expect(report.date).toBe(DATE);
    expect(report.designId).toBe('d-1');
    expect(report.branch).toBe('main');
  });

  it('omits designId/branch when not provided', () => {
    const report = review(wired555());
    expect('designId' in report).toBe(false);
    expect('branch' in report).toBe(false);
  });

  it('counts tally the findings by severity', () => {
    const report = review([...wired555(), { kind: 'set_component_props', id: 'vcc', props: { dnp: true } }]);
    const tally = { error: 0, warn: 0, info: 0 };
    for (const f of report.findings) tally[f.severity] += 1;
    expect(report.counts).toEqual(tally);
    expect(report.counts.error).toBeGreaterThan(0);
    expect(report.counts.warn).toBeGreaterThan(0);
    expect(report.counts.info).toBeGreaterThan(0);
  });

  it('repeat runs are deterministic and ordered errors → warns → infos', () => {
    const ops = [...wired555(), { kind: 'set_component_props', id: 'vcc', props: { dnp: true } } as OpBody];
    const a = review(ops);
    const b = review(ops);
    expect(a).toEqual(b);
    const rank = { error: 0, warn: 1, info: 2 } as const;
    const ranks = a.findings.map((f) => rank[f.severity]);
    expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
  });
});

describe('diffReports', () => {
  it('identical reports diff to nothing', () => {
    const a = review(wired555());
    const b = review(wired555());
    expect(diffReports(a, b)).toEqual({ opened: [], closed: [] });
  });

  it('a new problem shows up as opened', () => {
    const a = review(wired555());
    const b = review([...wired555(), { kind: 'add_component', id: 'q1', ref: 'Q1', partId: 'core:2n3904', partRev: 1 }]);
    const { opened, closed } = diffReports(a, b);
    expect(opened.map((f) => f.code)).toEqual(['REV-UNVERIFIED-PART']);
    expect(closed).toEqual([]);
  });

  it('a fixed problem shows up as closed', () => {
    const { opened, closed } = diffReports(review(wired555()), review(decoupled555()));
    expect(closed.map((f) => f.code)).toEqual(['REV-DECOUPLING-MISSING']);
    expect(opened).toEqual([]);
  });

  it('keys findings by (check, code, anchors) — same code on a different entity opens anew', () => {
    const a = review([{ kind: 'add_component', id: 'q1', ref: 'Q1', partId: 'core:2n3904', partRev: 1 }]);
    const b = review([{ kind: 'add_component', id: 'q2', ref: 'Q2', partId: 'core:2n3904', partRev: 1 }]);
    const { opened, closed } = diffReports(a, b);
    expect(opened).toHaveLength(1);
    expect(closed).toHaveLength(1);
  });
});

describe('codes', () => {
  const FUNDAMENTALS_SLUGS = [
    'duty-cycle',
    'floating-inputs',
    'ground-three-meanings',
    'impedance-vs-resistance',
    'ohms-law-in-practice',
    'power-and-heat',
    'pull-up-pull-down',
    'push-pull-vs-open-collector',
    'reading-a-datasheet',
    'rms-vs-peak',
    'series-vs-parallel',
    'si-prefixes-4k7',
    'tolerance-stacking',
    'voltage-vs-current',
  ];

  it('every REV code reuses an existing fundamentals concept slug', () => {
    for (const [code, info] of Object.entries(REV_CODES)) {
      expect(code).toMatch(/^REV-/);
      expect(FUNDAMENTALS_SLUGS).toContain(info.conceptSlug);
    }
  });

  it('conceptForReview resolves review codes and embedded ERC codes', () => {
    expect(conceptForReview('REV-DECOUPLING-MISSING')?.conceptSlug).toBe('impedance-vs-resistance');
    expect(conceptForReview('ERC-FLOATING-INPUT')?.conceptSlug).toBe('floating-inputs');
    expect(conceptForReview('REV-NOPE')).toBeUndefined();
  });

  it('every code a review can emit maps to a concept article', () => {
    const ops = [...wired555(), { kind: 'set_component_props', id: 'vcc', props: { dnp: true } } as OpBody];
    for (const f of review(ops).findings) {
      expect(conceptForReview(f.code), f.code).toBeDefined();
    }
    expect(Object.keys({ ...REV_CODES, ...ERC_CODES }).length).toBeGreaterThan(0);
  });
});

describe('golden: probe-input-protection', () => {
  function goldenGraph(): DesignGraph {
    const url = new URL('../../../tools/golden/fixtures/probe-input-protection/ops.json', import.meta.url);
    const envelopes = z.array(opEnvelopeSchema).parse(JSON.parse(readFileSync(url, 'utf8')));
    return materialize(envelopes).graph;
  }

  it('reviews with zero errors', () => {
    const report = runReview(goldenGraph(), parts, { date: DATE });
    expect(report.counts.error).toBe(0);
    expect(report.findings.filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('warns exactly on the unverified load-bearing parts (D2 TVS + the two power pseudo-symbols)', () => {
    // Documented: the fixture's only warns are REV-UNVERIFIED-PART —
    // core:tvs-unidirectional, core:pwr-vcc and core:pwr-gnd are all
    // provenance: unverified and either diode-class or power-pinned.
    // The only info is the 3V3 rail summary (nothing declares draw).
    const report = runReview(goldenGraph(), parts, { date: DATE });
    const warns = report.findings.filter((f) => f.severity === 'warn');
    expect(warns.map((f) => f.code)).toEqual([
      'REV-UNVERIFIED-PART',
      'REV-UNVERIFIED-PART',
      'REV-UNVERIFIED-PART',
    ]);
    const infos = report.findings.filter((f) => f.severity === 'info');
    expect(infos.map((f) => f.code)).toEqual(['REV-POWER-SUMMARY']);
    expect(infos[0]?.message).toBe('3V3: 0mA declared');
  });
});
