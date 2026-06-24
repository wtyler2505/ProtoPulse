import { existsSync, readFileSync } from 'node:fs';
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
 * ESP32-S3 co-sim CLOSED LOOP with a REAL SENSOR — the first "breadth"
 * slice (BL-0889) on top of the certified ADC closed loop: *an analog
 * SENSOR drives an ADC channel and the firmware reads it back tracking
 * the SPICE node, as a function of the sensor's modeled temperature.*
 *
 * No mocks. The pieces are all real:
 *   - a real `Esp32s3Core` running the landed `esp32s3-adc0-read.bin`
 *     firmware (loops: oneshot-convert SAR ADC1 ch0 → UART0 TX the 12-bit
 *     code as low byte then high byte);
 *   - a real design graph: a 3.3 V rail powers a `core:tmp36`, whose VOUT
 *     pin sources the analog node MID;
 *   - the `core:tmp36` SPICE emitter (this slice) modeling the Analog
 *     Devices TMP35/36/37 transfer function Vout = 10 mV/°C·T + 500 mV,
 *     with the operating temperature carried on the placed part's `value`
 *     (°C). At 25 °C → 0.75 V; at 50 °C → 1.00 V;
 *   - the real `runCosimClosedLoop` quantum loop, which feeds the bound
 *     net's previous solve back to the firmware's ADC reads.
 *
 * The sensor output is a flat DC node (no dynamics), so the one-quantum
 * staleness equals the current solve and tracking is exact for the
 * settled reads (quantum 1 onward; quantum 0 reads 0 V before any solve).
 */

const parts = seedPartDb();

const here = dirname(fileURLToPath(import.meta.url));
const FIRMWARE_BIN = join(here, '..', '..', 'emu', 'samples', 'esp32s3-adc0-read.bin');

/** TMP36 datasheet transfer function: Vout = 10 mV/°C · T + 500 mV. */
function tmp36Vout(tempC: number): number {
  return 0.01 * tempC + 0.5;
}

/** round(V / 3.3 × 4095) — the 12-bit code the firmware computes and TX's. */
function expectedCode(volts: number): number {
  return Math.round((volts / 3.3) * 4095);
}

/**
 * VCC(3.3V) → TMP36(+VS) ; TMP36(VOUT) → MID ; TMP36(GND) → GND. The TMP36
 * emitter sources MID at its modeled output voltage; the rail powers +VS so
 * that node has a DC path. The operating temperature rides on the part's
 * `value` (a bare °C number). The ops carry no coordinates, so nothing
 * floats — the netlist is purely topological.
 */
function tmp36Graph(tempC: number): DesignGraph {
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1, value: '3.3V' },
    { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:tmp36', partRev: 1, value: String(tempC) },
    { kind: 'add_component', id: 'gnd', ref: 'PWR2', partId: 'core:pwr-gnd', partRev: 1 },
    { kind: 'connect', port: 'vcc:1', newNetId: 'n_vcc' },
    { kind: 'connect', port: 'u1:1', netId: 'n_vcc' }, // +VS
    { kind: 'connect', port: 'u1:2', newNetId: 'n_mid' }, // VOUT
    { kind: 'connect', port: 'u1:3', newNetId: 'n_gnd' }, // GND
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
    // Required (.min(1)) output binding parked on the rail net; the Xtensa
    // firmware never drives a GPIO, so it is inert.
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

async function runAt(engine: SpiceEngine, tempC: number): Promise<Run> {
  const image = new Uint8Array(readFileSync(FIRMWARE_BIN));
  const core = new Esp32s3Core();
  core.loadFirmware(image);
  const spec = specFor();
  const cyclesPerQuantum = Math.round((spec.quantumS ?? 0) * core.clockHz);
  const result = await runCosimClosedLoop({ graph: tmp36Graph(tempC), parts, core, spec, engine });
  const uartBytes = [...core.drainUart()];
  const vMid = vectorByName(result.sim, 'v(mid)');
  const vals = vMid?.values ?? [];
  const solvedMidV = vals.at(-1) ?? Number.NaN;
  return { result, solvedMidV, uartBytes, cyclesPerQuantum };
}

describe('ESP32-S3 co-sim closed loop — TMP36 sensor read tracks the SPICE node (REAL, BL-0889)', () => {
  const engine = new SpiceEngine();
  let at25: Run;
  let at50: Run;

  beforeAll(async () => {
    expect(existsSync(FIRMWARE_BIN)).toBe(true);
    expect(readFileSync(FIRMWARE_BIN).length).toBe(75);
    await engine.start();
    at25 = await runAt(engine, 25);
    at50 = await runAt(engine, 50);
  }, 180_000);

  afterAll(async () => {
    await engine.stop();
  });

  it('SPICE solves the TMP36 output to 0.75 V at 25 °C (flat DC)', () => {
    expect(at25.solvedMidV).toBeCloseTo(tmp36Vout(25), 2); // 0.75 V, ±0.005
    const vals = vectorByName(at25.result.sim, 'v(mid)')?.values ?? [];
    expect(vals.length).toBeGreaterThan(0);
    expect(Math.min(...vals)).toBeCloseTo(tmp36Vout(25), 2);
    expect(Math.max(...vals)).toBeCloseTo(tmp36Vout(25), 2);
  });

  it('records firmware-initiated ADC conversions, all on channel 0', () => {
    expect(at25.result.adcReads.length).toBeGreaterThan(0);
    expect(at25.result.adcReads.every((r) => r.channel === 0)).toBe(true);
  });

  it('the closed loop feeds back the sensor node: settled reads track 0.75 V (±0.02 V)', () => {
    const settled = at25.result.adcReads.filter((r) => r.cycle >= at25.cyclesPerQuantum);
    expect(settled.length).toBeGreaterThan(5);
    for (const r of settled) {
      expect(r.volts).toBeCloseTo(at25.solvedMidV, 2);
    }
  });

  it('the value reached the firmware: UART TX 12-bit code matches round(Vout/3.3×4095) at 25 °C', () => {
    const bytes = at25.uartBytes;
    const evenLen = bytes.length - (bytes.length % 2);
    expect(evenLen).toBeGreaterThanOrEqual(2);
    const code = ((bytes[evenLen - 1] ?? -1) << 8) | (bytes[evenLen - 2] ?? -1);
    expect(code).toBe(expectedCode(at25.solvedMidV));
  });

  it('it is a real transfer function, not a constant: 50 °C → 1.00 V and the firmware tracks it', () => {
    // Proves the emitter models Vout = 10mV/°C·T + 500mV — a DIFFERENT
    // temperature solves to a DIFFERENT node voltage AND the firmware reads
    // it back. Without this, a hardcoded 0.75 V would pass the 25 °C tests.
    expect(at50.solvedMidV).toBeCloseTo(tmp36Vout(50), 2); // 1.00 V
    expect(at50.solvedMidV).not.toBeCloseTo(at25.solvedMidV, 2);
    const settled = at50.result.adcReads.filter((r) => r.cycle >= at50.cyclesPerQuantum);
    expect(settled.length).toBeGreaterThan(5);
    for (const r of settled) {
      expect(r.volts).toBeCloseTo(at50.solvedMidV, 2);
    }
    const bytes = at50.uartBytes;
    const evenLen = bytes.length - (bytes.length % 2);
    const code = ((bytes[evenLen - 1] ?? -1) << 8) | (bytes[evenLen - 2] ?? -1);
    expect(code).toBe(expectedCode(at50.solvedMidV));
  });
});
