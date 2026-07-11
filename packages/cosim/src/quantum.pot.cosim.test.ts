import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Esp32s3Core } from '@protopulse/emu';
import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { SpiceEngine, vectorByName } from '@protopulse/sim';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runCosimClosedLoop } from './quantum.js';

import type { ClosedLoopResult, ClosedLoopSpec } from './types.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';

/**
 * ESP32-S3 co-sim closed loop with a VARIABLE analog input — breadth slice 2
 * (after TMP36, BL-0889). A `core:pot-10k` rotary potentiometer wired as a
 * voltage divider drives ADC ch0; the firmware reads back the wiper voltage,
 * and it tracks the SPICE node as a function of the wiper position.
 *
 * The pot is a 3-terminal part (1=A, 2=WIPER, 3=B). The emitter (this slice)
 * models it as two resistors summing to 10 kΩ: A–WIPER = 10k·pos and
 * WIPER–B = 10k·(1−pos), where `pos` (the wiper fraction from A toward B) rides
 * on the placed part's `value` (default 0.5). With A→VCC(3.3 V) and B→GND, the
 * wiper sits at V = 3.3·(1−pos): pos=0.3 → 2.31 V, pos=0.7 → 0.99 V. A flat DC
 * node, so settled reads (quantum 1+) track exactly.
 */

const parts = seedPartDb();
const here = dirname(fileURLToPath(import.meta.url));
const FIRMWARE_BIN = join(here, '..', '..', 'emu', 'samples', 'esp32s3-adc0-read.bin');
const VCC_V = 3.3;

/** Wiper voltage for the A→VCC, B→GND divider: V = VCC·(1 − pos). */
function wiperV(pos: number): number {
  return VCC_V * (1 - pos);
}
function expectedCode(volts: number): number {
  return Math.round((volts / 3.3) * 4095);
}

/** VCC → pot A(1) ; pot WIPER(2) → MID(ADC0) ; pot B(3) → GND. */
function potGraph(pos: number): DesignGraph {
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1, value: '3.3V' },
    { kind: 'add_component', id: 'rv', ref: 'RV1', partId: 'core:pot-10k', partRev: 1, value: String(pos) },
    { kind: 'add_component', id: 'gnd', ref: 'PWR2', partId: 'core:pwr-gnd', partRev: 1 },
    { kind: 'connect', port: 'vcc:1', newNetId: 'n_vcc' },
    { kind: 'connect', port: 'rv:1', netId: 'n_vcc' }, // A → VCC
    { kind: 'connect', port: 'rv:2', newNetId: 'n_mid' }, // WIPER → MID
    { kind: 'connect', port: 'rv:3', newNetId: 'n_gnd' }, // B → GND
    { kind: 'connect', port: 'gnd:1', netId: 'n_gnd' },
    { kind: 'rename_net', netId: 'n_vcc', name: 'VCC' },
    { kind: 'rename_net', netId: 'n_mid', name: 'MID' },
    { kind: 'rename_net', netId: 'n_gnd', name: 'GND' },
  ];
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

function specFor(): ClosedLoopSpec {
  return {
    windowS: 200e-6,
    stepS: 1e-6,
    quantumS: 50e-6,
    bindings: [{ pin: 'B5', netId: 'n_vcc' }],
    adc: [{ channel: 0, netId: 'n_mid' }],
  };
}

interface Run {
  result: ClosedLoopResult;
  solvedMidV: number;
  uartBytes: number[];
  cyclesPerQuantum: number;
}

async function runAt(engine: SpiceEngine, pos: number): Promise<Run> {
  const image = new Uint8Array(readFileSync(FIRMWARE_BIN));
  const core = new Esp32s3Core();
  core.loadFirmware(image);
  const spec = specFor();
  const cyclesPerQuantum = Math.round((spec.quantumS ?? 0) * core.clockHz);
  const result = await runCosimClosedLoop({ graph: potGraph(pos), parts, core, spec, engine });
  const uartBytes = [...core.drainUart()];
  const vals = vectorByName(result.sim, 'v(mid)')?.values ?? [];
  return { result, solvedMidV: vals.at(-1) ?? Number.NaN, uartBytes, cyclesPerQuantum };
}

describe('ESP32-S3 co-sim closed loop — potentiometer wiper tracks the SPICE node (REAL, breadth slice 2)', () => {
  const engine = new SpiceEngine();
  let lo: Run; // pos=0.3 → 2.31 V
  let hi: Run; // pos=0.7 → 0.99 V

  beforeAll(async () => {
    await engine.start();
    lo = await runAt(engine, 0.3);
    hi = await runAt(engine, 0.7);
  }, 180_000);

  afterAll(async () => {
    await engine.stop();
  });

  it('SPICE solves the wiper divider: pos=0.3 → 2.31 V (flat DC)', () => {
    expect(lo.solvedMidV).toBeCloseTo(wiperV(0.3), 2); // 2.31 V
    const vals = vectorByName(lo.result.sim, 'v(mid)')?.values ?? [];
    expect(vals.length).toBeGreaterThan(0);
    expect(Math.min(...vals)).toBeCloseTo(wiperV(0.3), 2);
    expect(Math.max(...vals)).toBeCloseTo(wiperV(0.3), 2);
  });

  it('records firmware-initiated ADC conversions, all on channel 0', () => {
    expect(lo.result.adcReads.length).toBeGreaterThan(0);
    expect(lo.result.adcReads.every((r) => r.channel === 0)).toBe(true);
  });

  it('the closed loop feeds back the wiper node: settled reads track 2.31 V (±0.02 V)', () => {
    const settled = lo.result.adcReads.filter((r) => r.cycle >= lo.cyclesPerQuantum);
    expect(settled.length).toBeGreaterThan(5);
    for (const r of settled) {
      expect(r.volts).toBeCloseTo(lo.solvedMidV, 2);
    }
  });

  it('the value reached the firmware: UART TX 12-bit code matches round(V/3.3×4095) at pos=0.3', () => {
    const bytes = lo.uartBytes;
    const evenLen = bytes.length - (bytes.length % 2);
    expect(evenLen).toBeGreaterThanOrEqual(2);
    const code = ((bytes[evenLen - 1] ?? -1) << 8) | (bytes[evenLen - 2] ?? -1);
    expect(code).toBe(expectedCode(lo.solvedMidV));
  });

  it('the wiper is variable, not fixed: pos=0.7 → 0.99 V and the firmware tracks it', () => {
    expect(hi.solvedMidV).toBeCloseTo(wiperV(0.7), 2); // 0.99 V
    expect(hi.solvedMidV).not.toBeCloseTo(lo.solvedMidV, 2);
    const settled = hi.result.adcReads.filter((r) => r.cycle >= hi.cyclesPerQuantum);
    expect(settled.length).toBeGreaterThan(5);
    for (const r of settled) {
      expect(r.volts).toBeCloseTo(hi.solvedMidV, 2);
    }
    const bytes = hi.uartBytes;
    const evenLen = bytes.length - (bytes.length % 2);
    const code = ((bytes[evenLen - 1] ?? -1) << 8) | (bytes[evenLen - 2] ?? -1);
    expect(code).toBe(expectedCode(hi.solvedMidV));
  });
});
