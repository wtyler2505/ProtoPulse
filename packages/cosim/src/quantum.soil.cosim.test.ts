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
 * ESP32-S3 co-sim closed loop with a SUPPLY-DEPENDENT analog sensor — breadth
 * slice 3 (after TMP36 BL-0889 and the pot BL-0890). An FC-28 soil-moisture
 * module drives ADC ch0; the firmware reads the analog moisture level back.
 *
 * The FC-28 AO (pin 4) is the soil-resistance divider tap off the supply
 * (web-verified: dry soil → high AO near VCC, wet soil → low AO near 0). The
 * emitter (this slice) models AO = V_supply·(1 − moisture) as a behavioral
 * source referenced to GND — a SUPPLY-DEPENDENT B-source, unlike the fixed DC
 * sources of slices 1–2. The moisture fraction (0=dry … 1=wet, default 0.5)
 * rides on the placed part's `value`. With VCC=3.3 V: moisture 0.25 → 2.475 V,
 * 0.75 → 0.825 V. Flat DC node, so settled reads (quantum 1+) track exactly.
 */

const parts = seedPartDb();
const here = dirname(fileURLToPath(import.meta.url));
const FIRMWARE_BIN = join(here, '..', '..', 'emu', 'samples', 'esp32s3-adc0-read.bin');
const VCC_V = 3.3;

/** FC-28 AO = V_supply·(1 − moisture): dry (low moisture) → high voltage. */
function soilAO(moisture: number): number {
  return VCC_V * (1 - moisture);
}
function expectedCode(volts: number): number {
  return Math.round((volts / 3.3) * 4095);
}

/** VCC → soil VCC(1) ; soil GND(2) → GND ; soil AO(4) → MID(ADC0). DO(3) unused. */
function soilGraph(moisture: number): DesignGraph {
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1, value: '3.3V' },
    { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:soil-moisture', partRev: 1, value: String(moisture) },
    { kind: 'add_component', id: 'gnd', ref: 'PWR2', partId: 'core:pwr-gnd', partRev: 1 },
    { kind: 'connect', port: 'vcc:1', newNetId: 'n_vcc' },
    { kind: 'connect', port: 'u1:1', netId: 'n_vcc' }, // VCC
    { kind: 'connect', port: 'u1:2', newNetId: 'n_gnd' }, // GND
    { kind: 'connect', port: 'u1:4', newNetId: 'n_mid' }, // AO → MID
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

async function runAt(engine: SpiceEngine, moisture: number): Promise<Run> {
  const image = new Uint8Array(readFileSync(FIRMWARE_BIN));
  const core = new Esp32s3Core();
  core.loadFirmware(image);
  const spec = specFor();
  const cyclesPerQuantum = Math.round((spec.quantumS ?? 0) * core.clockHz);
  const result = await runCosimClosedLoop({ graph: soilGraph(moisture), parts, core, spec, engine });
  const uartBytes = [...core.drainUart()];
  const vals = vectorByName(result.sim, 'v(mid)')?.values ?? [];
  return { result, solvedMidV: vals.at(-1) ?? Number.NaN, uartBytes, cyclesPerQuantum };
}

describe('ESP32-S3 co-sim closed loop — FC-28 soil moisture tracks the SPICE node (REAL, breadth slice 3)', () => {
  const engine = new SpiceEngine();
  let dry: Run; // moisture=0.25 → 2.475 V
  let wet: Run; // moisture=0.75 → 0.825 V

  beforeAll(async () => {
    await engine.start();
    dry = await runAt(engine, 0.25);
    wet = await runAt(engine, 0.75);
  }, 180_000);

  afterAll(async () => {
    await engine.stop();
  });

  it('SPICE solves the FC-28 AO: moisture=0.25 (dry-ish) → 2.475 V (flat DC)', () => {
    expect(dry.solvedMidV).toBeCloseTo(soilAO(0.25), 2); // 2.475 V
    const vals = vectorByName(dry.result.sim, 'v(mid)')?.values ?? [];
    expect(vals.length).toBeGreaterThan(0);
    expect(Math.min(...vals)).toBeCloseTo(soilAO(0.25), 2);
    expect(Math.max(...vals)).toBeCloseTo(soilAO(0.25), 2);
  });

  it('records firmware-initiated ADC conversions, all on channel 0', () => {
    expect(dry.result.adcReads.length).toBeGreaterThan(0);
    expect(dry.result.adcReads.every((r) => r.channel === 0)).toBe(true);
  });

  it('the closed loop feeds back the AO node: settled reads track 2.475 V (±0.02 V)', () => {
    const settled = dry.result.adcReads.filter((r) => r.cycle >= dry.cyclesPerQuantum);
    expect(settled.length).toBeGreaterThan(5);
    for (const r of settled) {
      expect(r.volts).toBeCloseTo(dry.solvedMidV, 2);
    }
  });

  it('the value reached the firmware: UART TX 12-bit code matches round(V/3.3×4095) at moisture=0.25', () => {
    const bytes = dry.uartBytes;
    const evenLen = bytes.length - (bytes.length % 2);
    expect(evenLen).toBeGreaterThanOrEqual(2);
    const code = ((bytes[evenLen - 1] ?? -1) << 8) | (bytes[evenLen - 2] ?? -1);
    expect(code).toBe(expectedCode(dry.solvedMidV));
  });

  it('moisture drives the reading (wet < dry): moisture=0.75 → 0.825 V and the firmware tracks it', () => {
    expect(wet.solvedMidV).toBeCloseTo(soilAO(0.75), 2); // 0.825 V
    expect(wet.solvedMidV).toBeLessThan(dry.solvedMidV); // wetter soil → lower AO
    const settled = wet.result.adcReads.filter((r) => r.cycle >= wet.cyclesPerQuantum);
    expect(settled.length).toBeGreaterThan(5);
    for (const r of settled) {
      expect(r.volts).toBeCloseTo(wet.solvedMidV, 2);
    }
    const bytes = wet.uartBytes;
    const evenLen = bytes.length - (bytes.length % 2);
    const code = ((bytes[evenLen - 1] ?? -1) << 8) | (bytes[evenLen - 2] ?? -1);
    expect(code).toBe(expectedCode(wet.solvedMidV));
  });
});
