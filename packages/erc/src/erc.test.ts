import { describe, expect, it } from 'vitest';
import type { OpBody } from '@protopulse/graph';
import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { runErc } from './run.js';
import { pinPairVerdict } from './matrix.js';
import { ERC_CODES, conceptFor } from './codes.js';
import { PIN_ELECTRICAL_TYPES } from '@protopulse/parts';

const parts = seedPartDb();

function graphOf(ops: OpBody[]) {
  const result = materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op })));
  const failed = result.warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0) throw new Error(failed.map((w) => w.message).join('; '));
  return result.graph;
}

function codes(ops: OpBody[]): string[] {
  return runErc(graphOf(ops), parts).map((f) => f.code);
}

/** A clean two-pin loop: battery + resistor + LED, fully wired. */
function cleanCircuit(): OpBody[] {
  return [
    { kind: 'add_component', id: 'bat', ref: 'BT1', partId: 'core:battery', partRev: 1 },
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'led', ref: 'D1', partId: 'core:led', partRev: 1 },
    { kind: 'connect', port: 'bat:+', newNetId: 'nv' },
    { kind: 'connect', port: 'r1:1', netId: 'nv' },
    { kind: 'connect', port: 'r1:2', newNetId: 'nm' },
    { kind: 'connect', port: 'led:A', netId: 'nm' },
    { kind: 'connect', port: 'led:K', newNetId: 'ng' },
    { kind: 'connect', port: 'bat:-', netId: 'ng' },
  ];
}

describe('matrix', () => {
  it('is symmetric for every type pair', () => {
    for (const a of PIN_ELECTRICAL_TYPES) {
      for (const b of PIN_ELECTRICAL_TYPES) {
        expect(pinPairVerdict(a, b)).toEqual(pinPairVerdict(b, a));
      }
    }
  });

  it('flags the canonical conflicts', () => {
    expect(pinPairVerdict('output', 'output').severity).toBe('error');
    expect(pinPairVerdict('power_out', 'power_out').code).toBe('ERC-RAIL-SHORT');
    expect(pinPairVerdict('output', 'power_out').severity).toBe('error');
    expect(pinPairVerdict('nc', 'passive').code).toBe('ERC-NC-CONNECTED');
    expect(pinPairVerdict('output', 'open_collector').severity).toBe('warn');
    expect(pinPairVerdict('output', 'input').severity).toBe('ok');
    expect(pinPairVerdict('passive', 'passive').severity).toBe('ok');
    expect(pinPairVerdict('power_in', 'power_out').severity).toBe('ok');
  });
});

describe('runErc', () => {
  it('a clean circuit produces no findings', () => {
    expect(codes(cleanCircuit())).toEqual([]);
  });

  it('flags floating inputs (the NE555 with unwired control pins)', () => {
    const found = codes([
      { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
    ]);
    expect(found).toContain('ERC-FLOATING-INPUT'); // TRIG, RESET, THRES
    expect(found).toContain('ERC-POWER-UNSOURCED'); // VCC, GND unconnected
  });

  it('flags an unpowered supply net and clears it when a source arrives', () => {
    const base: OpBody[] = [
      { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
      { kind: 'connect', port: 'u1:8', newNetId: 'nvcc' },
      { kind: 'connect', port: 'u1:1', newNetId: 'ngnd' },
      // tie inputs so floating-input noise stays out of this test
      { kind: 'connect', port: 'u1:2', netId: 'ngnd' },
      { kind: 'connect', port: 'u1:6', netId: 'ngnd' },
      { kind: 'connect', port: 'u1:4', netId: 'nvcc' },
    ];
    const before = codes(base);
    expect(before.filter((c) => c === 'ERC-POWER-UNSOURCED')).toHaveLength(2);
    const powered = codes([
      ...base,
      { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1 },
      { kind: 'add_component', id: 'gnd', ref: 'PWR2', partId: 'core:pwr-gnd', partRev: 1 },
      { kind: 'connect', port: 'vcc:1', netId: 'nvcc' },
      { kind: 'connect', port: 'gnd:1', netId: 'ngnd' },
    ]);
    expect(powered).not.toContain('ERC-POWER-UNSOURCED');
  });

  it('warns on single-port nets', () => {
    const found = codes([
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'r1:1', newNetId: 'n1' },
    ]);
    expect(found).toContain('ERC-SINGLE-PORT-NET');
  });

  it('flags rail shorts via the matrix', () => {
    const found = codes([
      { kind: 'add_component', id: 'b1', ref: 'BT1', partId: 'core:battery', partRev: 1 },
      { kind: 'add_component', id: 'b2', ref: 'BT2', partId: 'core:battery', partRev: 1 },
      { kind: 'connect', port: 'b1:+', newNetId: 'n1' },
      { kind: 'connect', port: 'b2:+', netId: 'n1' },
    ]);
    expect(found).toContain('ERC-RAIL-SHORT');
  });

  it('catches the missing-pull-up I2C-class bug and the fix re-runs clean', () => {
    const base: OpBody[] = [
      { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
      { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1 },
      { kind: 'add_component', id: 'gnd', ref: 'PWR2', partId: 'core:pwr-gnd', partRev: 1 },
      { kind: 'add_component', id: 'rl', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'u1:8', newNetId: 'nvcc' },
      { kind: 'connect', port: 'vcc:1', netId: 'nvcc' },
      { kind: 'connect', port: 'u1:1', newNetId: 'ngnd' },
      { kind: 'connect', port: 'gnd:1', netId: 'ngnd' },
      { kind: 'connect', port: 'u1:2', netId: 'ngnd' },
      { kind: 'connect', port: 'u1:6', netId: 'ngnd' },
      { kind: 'connect', port: 'u1:4', netId: 'nvcc' },
      // DISCH (open collector) wired to a load with no pull-up:
      { kind: 'connect', port: 'u1:7', newNetId: 'ndis' },
      { kind: 'connect', port: 'rl:1', netId: 'ndis' },
      { kind: 'connect', port: 'rl:2', netId: 'ngnd' },
    ];
    const graph = graphOf(base);
    const findings = runErc(graph, parts);
    const pullup = findings.find((f) => f.code === 'ERC-OC-NO-PULLUP');
    expect(pullup).toBeDefined();
    expect(pullup?.fix).toBeDefined();

    // Apply the executable fix; the finding must close.
    const fixed = graphOf([...base, ...(pullup?.fix ?? [])]);
    const after = runErc(fixed, parts);
    expect(after.map((f) => f.code)).not.toContain('ERC-OC-NO-PULLUP');
  });

  it('skips the pull-up fix when no candidate rail exists', () => {
    const found = runErc(
      graphOf([
        { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
        { kind: 'connect', port: 'u1:7', newNetId: 'ndis' },
        { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
        { kind: 'connect', port: 'r1:1', netId: 'ndis' },
      ]),
      parts,
    );
    const pullup = found.find((f) => f.code === 'ERC-OC-NO-PULLUP');
    expect(pullup).toBeDefined();
    expect(pullup?.fix).toBeUndefined();
  });

  it('enforces current_max constraints from declared draws', () => {
    const over: OpBody[] = [
      ...cleanCircuit(),
      { kind: 'add_constraint', id: 'k1', body: { kind: 'current_max', netId: 'nm', amps: 0.01 }, rationale: 'thin trace' },
    ];
    const found = runErc(graphOf(over), parts);
    const budget = found.find((f) => f.code === 'ERC-CURRENT-BUDGET');
    expect(budget).toBeDefined();
    expect(budget?.message).toContain('20.0mA');
    expect(budget?.message).toContain('thin trace');

    const under: OpBody[] = [
      ...cleanCircuit(),
      { kind: 'add_constraint', id: 'k1', body: { kind: 'current_max', netId: 'nm', amps: 0.05 } },
    ];
    expect(runErc(graphOf(under), parts).map((f) => f.code)).not.toContain('ERC-CURRENT-BUDGET');
  });

  it('reports unknown parts and pins as warnings, not crashes', () => {
    const found = codes([
      { kind: 'add_component', id: 'x1', ref: 'X1', partId: 'ghost:part', partRev: 1 },
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'r1:99', newNetId: 'n1' },
      { kind: 'connect', port: 'r1:1', netId: 'n1' },
    ]);
    expect(found).toContain('ERC-UNKNOWN-PART');
    expect(found).toContain('ERC-UNKNOWN-PIN');
  });

  it('orders findings deterministically: errors before warns', () => {
    const findings = runErc(
      graphOf([
        { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
        { kind: 'connect', port: 'u1:5', newNetId: 'n1' },
      ]),
      parts,
    );
    const sevs = findings.map((f) => f.severity);
    expect([...sevs].sort((a, b) => (a === b ? 0 : a === 'error' ? -1 : 1))).toEqual(sevs);
  });
});

describe('codes', () => {
  it('every emitted code maps to a concept article', () => {
    expect(conceptFor('ERC-FLOATING-INPUT')?.conceptSlug).toBe('floating-inputs');
    for (const [code, info] of Object.entries(ERC_CODES)) {
      expect(code).toMatch(/^ERC-/);
      expect(info.conceptSlug.length).toBeGreaterThan(0);
    }
  });
});
