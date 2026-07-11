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
 * ESP32-S3 co-sim CLOSED LOOP, end to end with REAL components — the
 * ROADMAP "ESP32-S3 completion gate" criterion (3): *an analog node
 * drives an ADC channel and the firmware reads it back tracking the
 * SPICE node.*
 *
 * No mocks. The pieces are all real:
 *   - a real `Esp32s3Core` running the landed `esp32s3-adc0-read.bin`
 *     raw-IRAM firmware (loops: oneshot-convert SAR ADC1 ch0 → UART0 TX
 *     the 12-bit code as low byte then high byte);
 *   - a real design graph — a 3.3 V rail through a 10k/10k resistor
 *     divider, whose MID node SPICE solves to exactly 1.65 V (DC, flat);
 *   - the real `runCosimClosedLoop` quantum loop (quantum.ts), which
 *     installs the ADC sampler, looks up the SPICE node bound to channel
 *     0, interpolates the PREVIOUS quantum's solve at the read cycle, and
 *     hands that voltage back to the firmware.
 *
 * A purely-resistive divider has no dynamics: every quantum's solve is
 * the same flat 1.65 V, so the one-quantum staleness (previous solve)
 * equals the current solve and tracking is EXACT — except quantum 0,
 * where nothing has been solved yet and the sampler answers 0 V
 * (makeVoltsAt(null), see quantum.ts). So the certification asserts on
 * the SETTLED reads (quantum 1 onward).
 */

const parts = seedPartDb();

const here = dirname(fileURLToPath(import.meta.url));
const FIRMWARE_BIN = join(here, '..', '..', 'emu', 'samples', 'esp32s3-adc0-read.bin');

const VCC_V = 3.3;
/** 10k/10k divider from a 3.3 V rail → MID = 3.3 × 10k/(10k+10k) = 1.65 V. */
const EXPECT_MID_V = VCC_V / 2; // 1.65

/** round(V / 3.3 × 4095) — the 12-bit code the firmware computes and TX's. */
function expectedCode(volts: number): number {
  return Math.round((volts / 3.3) * 4095);
}

/**
 * VCC(3.3V) → R1(10k) → MID → R2(10k) → GND. The pwr-vcc symbol emits an
 * ideal `V… 0 DC 3.3` rail; the divider sets MID to a clean 1.65 V with
 * no transient (flat from t=0). Integer-nanometer geometry is irrelevant
 * here — the netlist is topological — but the ops carry no coordinates,
 * so nothing floats.
 */
function dividerGraph(): DesignGraph {
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1, value: '3.3V' },
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '10k' },
    { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1, value: '10k' },
    { kind: 'add_component', id: 'gnd', ref: 'PWR2', partId: 'core:pwr-gnd', partRev: 1 },
    { kind: 'connect', port: 'vcc:1', newNetId: 'n_vcc' },
    { kind: 'connect', port: 'r1:1', netId: 'n_vcc' },
    { kind: 'connect', port: 'r1:2', newNetId: 'n_mid' },
    { kind: 'connect', port: 'r2:1', netId: 'n_mid' },
    { kind: 'connect', port: 'r2:2', newNetId: 'n_gnd' },
    { kind: 'connect', port: 'gnd:1', netId: 'n_gnd' },
    { kind: 'rename_net', netId: 'n_vcc', name: 'VCC' },
    { kind: 'rename_net', netId: 'n_mid', name: 'MID' },
    { kind: 'rename_net', netId: 'n_gnd', name: 'GND' },
  ];
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

/**
 * 200 µs window / 50 µs quantum / 1 µs step → 4 quanta: quantum 0 is the
 * 0 V staleness boundary, quanta 1–3 track the solved node. The required
 * (`.min(1)`) output binding is parked on the rail net 'VCC' through the
 * 30 Ω behavioral GPIO Rout — the ideal rail source dwarfs 30 Ω, so MID
 * stays 1.65 V regardless. The Xtensa firmware never drives a GPIO, so
 * the binding is inert; the AVR-style pin name only has to satisfy the
 * port-letter+bit schema.
 */
const SPEC: ClosedLoopSpec = {
  windowS: 200e-6,
  stepS: 1e-6,
  quantumS: 50e-6,
  bindings: [{ pin: 'B5', netId: 'n_vcc' }],
  adc: [{ channel: 0, netId: 'n_mid' }],
};

describe('ESP32-S3 co-sim closed loop — firmware ADC read tracks the SPICE node (REAL)', () => {
  const engine = new SpiceEngine();
  let result: ClosedLoopResult;
  let solvedMidV: number;
  /** Cycles per quantum on the 240 MHz ESP32-S3 timebase = 12 000. */
  let cyclesPerQuantum: number;
  /** Everything the firmware TX'd over the whole window. The quantum loop
   *  never drains UART, so after the run the core still holds it all. */
  let uartBytes: number[];

  beforeAll(async () => {
    expect(existsSync(FIRMWARE_BIN)).toBe(true);
    const image = new Uint8Array(readFileSync(FIRMWARE_BIN));
    expect(image.length).toBe(75); // the landed raw-IRAM ADC reader

    await engine.start();
    const core = new Esp32s3Core();
    core.loadFirmware(image);
    cyclesPerQuantum = Math.round((SPEC.quantumS ?? 0) * core.clockHz);

    result = await runCosimClosedLoop({
      graph: dividerGraph(),
      parts,
      core,
      spec: SPEC,
      engine,
    });
    uartBytes = [...core.drainUart()];

    const vMid = vectorByName(result.sim, 'v(mid)');
    expect(vMid).toBeDefined();
    const vals = vMid?.values ?? [];
    expect(vals.length).toBeGreaterThan(0);
    // Flat DC node: every solved point equals the divider voltage.
    solvedMidV = vals.at(-1) ?? Number.NaN;
  }, 120_000);

  afterAll(async () => {
    await engine.stop();
  });

  it('SPICE solves the 10k/10k divider mid-node to 1.65 V (flat DC)', () => {
    expect(solvedMidV).toBeCloseTo(EXPECT_MID_V, 2); // ±0.005
    const vMid = vectorByName(result.sim, 'v(mid)');
    const vals = vMid?.values ?? [];
    // No dynamics: min and max both sit on 1.65 V.
    expect(Math.min(...vals)).toBeCloseTo(EXPECT_MID_V, 2);
    expect(Math.max(...vals)).toBeCloseTo(EXPECT_MID_V, 2);
  });

  it('records firmware-initiated ADC conversions, all on channel 0', () => {
    expect(result.adcReads.length).toBeGreaterThan(0);
    expect(result.adcReads.every((r) => r.channel === 0)).toBe(true);
  });

  it('the closed loop feeds back the solved node: settled reads track MID (±0.02 V)', () => {
    // Quantum 0 reads 0 V (nothing solved yet); quanta 1+ see the flat
    // solve, zero-order-held past solve-0's end → exact tracking.
    const settled = result.adcReads.filter((r) => r.cycle >= cyclesPerQuantum);
    // The firmware loop is tiny (~hundreds of cycles/pass) over 12 000+
    // cycles/quantum, so settled reads number in the dozens — not vacuous.
    expect(settled.length).toBeGreaterThan(5);
    for (const r of settled) {
      expect(r.volts).toBeCloseTo(solvedMidV, 2); // ±0.005, tighter than the ±0.02 budget
    }
  });

  it('the value reached the firmware: UART TX 12-bit code matches round(MID/3.3×4095)', () => {
    // The firmware TX's each conversion as [low, high]. Pairs align from
    // index 0 (low byte stored first). Quantum 0 emits code 0 ([0,0]);
    // settled passes emit the divider code. Decode the LAST complete pair
    // — the window may cut the final conversion after its low byte.
    const bytes = uartBytes;
    const evenLen = bytes.length - (bytes.length % 2);
    expect(evenLen).toBeGreaterThanOrEqual(2);
    const lastLow = bytes[evenLen - 2] ?? -1;
    const lastHigh = bytes[evenLen - 1] ?? -1;
    const code = (lastHigh << 8) | lastLow;
    expect(code).toBe(expectedCode(solvedMidV));
  });
});
