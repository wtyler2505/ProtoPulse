import * as emu from '@protopulse/emu';
import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { SpiceEngine, vectorByName } from '@protopulse/sim';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runCosimClosedLoop } from './quantum.js';

import type {
  AdcReadRequest,
  AdcSampler,
  ClosedLoopResult,
  ClosedLoopSpec,
} from './types.js';
import type { DigitalLevel, McuCore, PinEvent } from '@protopulse/emu';
import type { DesignGraph, OpBody } from '@protopulse/graph';

/**
 * The closed loop, end to end — first against a scripted FakeCore that
 * implements the PINNED ADC contract (always runs), then against the
 * REAL Atmega328pCore + a hand-assembled bang-bang firmware, gated on
 * the emu ADC track having landed (`describe.skipIf(!hasAdc)` — it
 * activates by itself the moment `setAdcSampler` exists on the core).
 */

const parts = seedPartDb();

/** RC low-pass: R1 (1k) DRIVE→CAP_OUT, C1 (100nF) CAP_OUT→GND, τ = 100 µs. */
function rcGraph(): DesignGraph {
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '1k' },
    { kind: 'add_component', id: 'c1', ref: 'C1', partId: 'core:capacitor', partRev: 1, value: '100nF' },
    { kind: 'add_component', id: 'gnd', ref: 'PWR1', partId: 'core:pwr-gnd', partRev: 1 },
    { kind: 'connect', port: 'r1:1', newNetId: 'n_drive' },
    { kind: 'connect', port: 'r1:2', newNetId: 'n_cap' },
    { kind: 'connect', port: 'c1:1', netId: 'n_cap' },
    { kind: 'connect', port: 'c1:2', newNetId: 'n_gnd' },
    { kind: 'connect', port: 'gnd:1', netId: 'n_gnd' },
    { kind: 'rename_net', netId: 'n_drive', name: 'DRIVE' },
    { kind: 'rename_net', netId: 'n_cap', name: 'CAP_OUT' },
    { kind: 'rename_net', netId: 'n_gnd', name: 'GND' },
  ];
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

/**
 * A scripted core implementing the PINNED ADC contract: drives B5 high
 * at power-on, converts channel 0 once per step (mid-step), and runs a
 * software bang-bang at 2.5 V on whatever volts the sampler returns.
 */
class BangBangFakeCore implements McuCore {
  readonly clockHz = 16_000_000;
  private cycles = 0;
  private level: DigitalLevel = 0;
  private sampler: AdcSampler | null = null;
  private pending: AdcReadRequest[] = [];
  readonly pinsDriven: { pin: string; level: DigitalLevel }[] = [];
  drainedBatches = 0;

  loadFirmware(): void {
    // scripted — nothing to load
  }

  step(maxCycles: number): { cycles: number; events: PinEvent[] } {
    const events: PinEvent[] = [];
    if (this.cycles === 0) {
      this.level = 1;
      events.push({ pin: 'B5', level: 1, cycle: 0 });
    }
    if (this.sampler !== null) {
      const sampleCycle = this.cycles + Math.floor(maxCycles / 2);
      const volts = this.sampler(0, sampleCycle);
      this.pending.push({ channel: 0, cycle: sampleCycle });
      const want: DigitalLevel = volts >= 2.5 ? 0 : 1;
      if (want !== this.level) {
        this.level = want;
        events.push({ pin: 'B5', level: want, cycle: sampleCycle });
      }
    }
    this.cycles += maxCycles;
    return { cycles: maxCycles, events };
  }

  setPin(pin: string, level: DigitalLevel): void {
    this.pinsDriven.push({ pin, level });
  }

  // ── The PINNED ADC surface ──
  setAdcSampler(fn: AdcSampler): void {
    this.sampler = fn;
  }
  drainAdcReads(): AdcReadRequest[] {
    this.drainedBatches += 1;
    const out = this.pending;
    this.pending = [];
    return out;
  }

  uartWrite(): void {
    // unused
  }
  drainUart(): Uint8Array {
    return new Uint8Array(0);
  }
  inspect(): { pc: number; cycles: number; sreg: number; sp: number } {
    return { pc: 0, cycles: this.cycles, sreg: 0, sp: 0 };
  }
  reset(): void {
    this.cycles = 0;
    this.level = 0;
    this.pending = [];
  }
}

/** Same scripted core minus the pinned ADC surface — pure McuCore. */
class PlainFakeCore implements McuCore {
  readonly clockHz = 16_000_000;
  private cycles = 0;
  loadFirmware(): void {
    // nothing
  }
  step(maxCycles: number): { cycles: number; events: PinEvent[] } {
    const events: PinEvent[] =
      this.cycles === 0 ? [{ pin: 'B5', level: 1, cycle: 0 }] : [];
    this.cycles += maxCycles;
    return { cycles: maxCycles, events };
  }
  setPin(): void {
    // nothing listens
  }
  uartWrite(): void {
    // unused
  }
  drainUart(): Uint8Array {
    return new Uint8Array(0);
  }
  inspect(): { pc: number; cycles: number; sreg: number; sp: number } {
    return { pc: 0, cycles: this.cycles, sreg: 0, sp: 0 };
  }
  reset(): void {
    this.cycles = 0;
  }
}

const FAKE_SPEC: ClosedLoopSpec = {
  windowS: 500e-6,
  stepS: 1e-6,
  quantumS: 50e-6,
  bindings: [{ pin: 'B5', netId: 'n_drive', voltsHigh: 5, routOhms: 30, riseS: 100e-9 }],
  inputs: [{ pin: 'D2', netId: 'n_cap' }],
  adc: [{ channel: 0, netId: 'n_cap' }],
};

describe('runCosimClosedLoop — scripted FakeCore through the RC loop', () => {
  const engine = new SpiceEngine();
  let core: BangBangFakeCore;
  let result: ClosedLoopResult;

  beforeAll(async () => {
    await engine.start();
    core = new BangBangFakeCore();
    result = await runCosimClosedLoop({
      graph: rcGraph(),
      parts,
      core,
      spec: FAKE_SPEC,
      engine,
    });
  }, 120_000);

  afterAll(async () => {
    await engine.stop();
  });

  it('cuts the window into quanta and counts one full re-solve per quantum', () => {
    expect(result.quanta).toBe(10); // 500 µs / 50 µs
    expect(result.rerunSolves).toBe(10); // the O(n²) honesty counter
  });

  it('keeps exact cycle and virtual-time bookkeeping across quanta', () => {
    expect(result.mcuCycles).toBe(8000); // ceil(16 MHz × 500 µs), exact budgets
    expect(result.virtualTimeS).toBeCloseTo(500e-6, 12);
  });

  it('feeds the sampler 0 V on quantum 0, real solved volts afterwards', () => {
    expect(result.adcReads).toHaveLength(10); // one conversion per quantum
    expect(result.adcReads[0]?.volts).toBe(0); // nothing solved yet
    expect(result.adcReads.every((r) => r.channel === 0)).toBe(true);
    expect(result.adcReads.every((r) => r.volts >= 0 && r.volts <= 5)).toBe(true);
    expect(Math.max(...result.adcReads.map((r) => r.volts))).toBeGreaterThan(2.5);
    // Conversion stamps advance monotonically with the loop.
    const cycles = result.adcReads.map((r) => r.cycle);
    expect([...cycles].sort((a, b) => a - b)).toEqual(cycles);
  });

  it('closes the loop: the fed-back cap voltage makes B5 bang-bang', () => {
    const b5 = result.pinEvents.filter((e) => e.pin === 'B5');
    expect(b5[0]).toEqual({ pin: 'B5', level: 1, cycle: 0 });
    expect(b5.length).toBeGreaterThanOrEqual(3); // high, low, high at least
    expect(b5.some((e) => e.level === 0)).toBe(true);
    expect(b5.filter((e) => e.level === 1).length).toBeGreaterThanOrEqual(2);
  });

  it('bounds the cap around the 2.5 V scripted threshold once the loop bites', () => {
    const vCap = vectorByName(result.sim, 'v(cap_out)');
    const time = vectorByName(result.sim, 'time');
    expect(vCap).toBeDefined();
    const ts = time?.values ?? [];
    const late = (vCap?.values ?? []).filter((_, i) => (ts[i] ?? 0) >= 250e-6);
    expect(late.length).toBeGreaterThan(10);
    expect(Math.min(...late)).toBeGreaterThan(0.5);
    expect(Math.max(...late)).toBeLessThan(4.5);
    // …and it genuinely oscillates rather than parking on a rail.
    expect(Math.max(...late) - Math.min(...late)).toBeGreaterThan(0.2);
  });

  it('drives the comparator input D2 every quantum and records its rising edge', () => {
    const d2 = core.pinsDriven.filter((p) => p.pin === 'D2');
    expect(d2).toHaveLength(10); // re-driven at every quantum boundary
    expect(d2[0]?.level).toBe(0); // quantum 0 compares 0 V → low
    expect(result.inputEdges.length).toBeGreaterThanOrEqual(1);
    expect(result.inputEdges[0]?.pin).toBe('D2');
    expect(result.inputEdges[0]?.level).toBe(1); // the cap charging past VIH
  });

  it('drains the pinned ADC queue every quantum, leaving it empty', () => {
    expect(core.drainedBatches).toBe(10);
    expect(core.drainAdcReads()).toHaveLength(0);
  });

  it('rebuilds the FULL PWL each quantum — the final card carries the whole history', () => {
    const card = result.pwlSources.B5 ?? '';
    expect(card).toContain('Vb5 b5_drv 0 PWL(');
    expect(card).toContain('Rb5 b5_drv drive 30');
    const inner = /PWL\(([^)]*)\)/.exec(card)?.[1] ?? '';
    const pointCount = inner.split(/\s+/).length / 2;
    // ≥3 edges → ≥3 ramps over the full window, plus the endpoints.
    expect(pointCount).toBeGreaterThanOrEqual(8);
  });

  it('hands back a full CosimResult: final solve + fidelity manifest', () => {
    expect(result.sim.manifest.find((e) => e.ref === 'R1')?.tier).toBe('spice');
    expect(result.sim.manifest.find((e) => e.ref === 'C1')?.tier).toBe('spice');
    const time = vectorByName(result.sim, 'time');
    expect(Math.max(...(time?.values ?? [0]))).toBeCloseTo(500e-6, 9);
  });
});

describe('runCosimClosedLoop — no feedback bindings on a plain McuCore', () => {
  const engine = new SpiceEngine();
  let result: ClosedLoopResult;

  beforeAll(async () => {
    await engine.start();
    // 120 µs window over a 50 µs quantum → 3 quanta, last one short.
    result = await runCosimClosedLoop({
      graph: rcGraph(),
      parts,
      core: new PlainFakeCore(),
      spec: { windowS: 120e-6, stepS: 1e-6, quantumS: 50e-6, bindings: [{ pin: 'B5', netId: 'n_drive' }] },
      engine,
    });
  }, 120_000);

  afterAll(async () => {
    await engine.stop();
  });

  it('runs without the pinned ADC surface when no ADC bindings are asked for', () => {
    expect(result.quanta).toBe(3); // ceil(120/50)
    expect(result.rerunSolves).toBe(3);
    expect(result.adcReads).toHaveLength(0);
    expect(result.inputEdges).toHaveLength(0);
  });

  it('clamps the last quantum to the window end', () => {
    expect(result.mcuCycles).toBe(Math.ceil(16e6 * 120e-6));
    const time = vectorByName(result.sim, 'time');
    expect(Math.max(...(time?.values ?? [0]))).toBeCloseTo(120e-6, 9);
  });

  it('still injects the PWL output boundary and solves the analog side', () => {
    expect(result.pwlSources.B5).toContain('PWL(');
    const vCap = vectorByName(result.sim, 'v(cap_out)');
    // B5 high from t=0 through a τ=100 µs RC: cap ends past 2 V.
    expect(Math.max(...(vCap?.values ?? [0]))).toBeGreaterThan(2);
  });
});

// ─── REAL closed-loop integration (activates when the emu ADC lands) ───

const emuAny = emu as unknown as Record<string, unknown>;
const probeCore = new emu.Atmega328pCore() as unknown as McuCore & {
  setAdcSampler?: (fn: AdcSampler) => void;
};
const hasAdc = typeof probeCore.setAdcSampler === 'function';

/**
 * ATmega328P ADC registers, DATA-SPACE addresses (datasheet register
 * summary — extended I/O, reachable only via LDS/STS): ADCL 0x78,
 * ADCH 0x79, ADCSRA 0x7A, ADMUX 0x7C. Real silicon values; never
 * approximated (Hardware & Component Verification Protocol).
 */
const ADCL = 0x78;
const ADCH = 0x79;
const ADCSRA = 0x7a;
const ADMUX = 0x7c;

/** One assembled instruction, whatever shape the emu asm helpers emit. */
type AsmWord = ReturnType<typeof emu.LDI>;

/** Defensive mnemonic lookup: the exact asm surface the emu ADC track
 *  ships is not visible from here, so missing helpers must fail loudly
 *  instead of assembling garbage. */
function asmOp(name: string): (...args: number[]) => AsmWord {
  const fn = emuAny[name];
  if (typeof fn !== 'function') {
    throw new Error(
      `@protopulse/emu exports no ${name}(...) assembler helper — ` +
        'align this bang-bang firmware with the emu ADC test programs',
    );
  }
  return fn as (...args: number[]) => AsmWord;
}

/**
 * Hand-assembled bang-bang regulator around 2.5 V on ADC channel 0,
 * actuating B5 (word-indexed; LDS/STS are TWO words each):
 *
 *   0  LDI  r16,0x20
 *   1  OUT  DDRB,r16        ; B5 → output, low
 *   2  SBI  PORTB,5         ; start charging
 *   3  LDI  r16,0x40        ; loop: AVcc ref, MUX=0 (no ADLAR)
 *   4  STS  ADMUX,r16       ; words 4-5
 *   6  LDI  r16,0xC2        ; ADEN | ADSC | prescaler ÷4
 *   7  STS  ADCSRA,r16      ; words 7-8
 *   9  LDS  r16,ADCSRA      ; wait: words 9-10
 *  11  SBRC r16,6           ; ADSC clear (done) → skip the loop-back
 *  12  RJMP wait            ; → 9
 *  13  LDS  r17,ADCL        ; words 13-14 (read low first — latch protocol)
 *  15  LDS  r16,ADCH        ; words 15-16 (top 2 bits of the 10-bit result)
 *  17  SBRC r16,1           ; bit1 clear (< 512 counts = 2.5 V) → skip
 *  18  RJMP above           ; → 21
 *  19  SBI  PORTB,5         ; below threshold → charge
 *  20  RJMP loop            ; → 3
 *  21  CBI  PORTB,5         ; above: above threshold → discharge
 *  22  RJMP loop            ; → 3
 */
function assembleBangBang(): Uint8Array {
  const { assemble, IO, LDI, OUT, SBI, CBI, RJMP } = emu;
  const LDS = asmOp('LDS');
  const STS = asmOp('STS');
  const SBRC = asmOp('SBRC');
  return assemble([
    LDI(16, 0x20), //  0
    OUT(IO.DDRB, 16), //  1
    SBI(IO.PORTB, 5), //  2
    LDI(16, 0x40), //  3: loop
    STS(ADMUX, 16), //  4-5
    LDI(16, 0xc2), //  6
    STS(ADCSRA, 16), //  7-8
    LDS(16, ADCSRA), //  9-10: wait
    SBRC(16, 6), // 11
    RJMP(9 - 13), // 12: → 9
    LDS(17, ADCL), // 13-14
    LDS(16, ADCH), // 15-16
    SBRC(16, 1), // 17
    RJMP(21 - 19), // 18: → 21
    SBI(IO.PORTB, 5), // 19
    RJMP(3 - 21), // 20: → 3
    CBI(IO.PORTB, 5), // 21: above
    RJMP(3 - 23), // 22: → 3
  ] as Parameters<typeof assemble>[0]);
}

describe.skipIf(!hasAdc)(
  'runCosimClosedLoop — REAL bang-bang firmware self-regulating its own RC node',
  () => {
    const engine = new SpiceEngine();
    let result: ClosedLoopResult;

    /** 600 µs window, 50 µs quanta: ~5 RC-staleness oscillation periods. */
    const SPEC: ClosedLoopSpec = {
      windowS: 600e-6,
      stepS: 2e-6,
      quantumS: 50e-6,
      bindings: [{ pin: 'B5', netId: 'n_drive', voltsHigh: 5, routOhms: 30, riseS: 100e-9 }],
      adc: [{ channel: 0, netId: 'n_cap' }],
    };

    beforeAll(async () => {
      await engine.start();
      const core = new emu.Atmega328pCore();
      core.loadFirmware(assembleBangBang());
      result = await runCosimClosedLoop({ graph: rcGraph(), parts, core, spec: SPEC, engine });
    }, 180_000);

    afterAll(async () => {
      await engine.stop();
    });

    it('sustains the oscillation: ≥3 B5 edges after the loop settles', () => {
      const settleCycle = 16e6 * 300e-6; // give the cap two τ to first-cross
      const lateEdges = result.pinEvents.filter(
        (e) => e.pin === 'B5' && e.cycle >= settleCycle,
      );
      expect(lateEdges.length).toBeGreaterThanOrEqual(3);
      expect(lateEdges.some((e) => e.level === 0)).toBe(true);
      expect(lateEdges.some((e) => e.level === 1)).toBe(true);
    });

    it('keeps the cap bounded around the firmware threshold (2.5 V ± staleness)', () => {
      const vCap = vectorByName(result.sim, 'v(cap_out)');
      const time = vectorByName(result.sim, 'time');
      const ts = time?.values ?? [];
      const late = (vCap?.values ?? []).filter((_, i) => (ts[i] ?? 0) >= 300e-6);
      expect(late.length).toBeGreaterThan(10);
      expect(Math.min(...late)).toBeGreaterThan(0.8); // never collapses to GND
      expect(Math.max(...late)).toBeLessThan(4.2); // never runs to the rail
      // Straddles the 2.5 V threshold rather than parking on one side.
      expect(Math.min(...late)).toBeLessThan(3.0);
      expect(Math.max(...late)).toBeGreaterThan(2.0);
    });

    it('records the firmware’s real conversions, volts attached', () => {
      expect(result.adcReads.length).toBeGreaterThan(12); // ≥ one per quantum
      expect(result.adcReads.every((r) => r.channel === 0)).toBe(true);
      expect(result.adcReads.every((r) => r.volts >= 0 && r.volts <= 5)).toBe(true);
      expect(Math.max(...result.adcReads.map((r) => r.volts))).toBeGreaterThan(2.4);
    });

    it('counts its own cost: one full from-zero re-solve per quantum', () => {
      expect(result.quanta).toBe(12);
      expect(result.rerunSolves).toBe(12);
      expect(result.mcuCycles).toBeGreaterThanOrEqual(Math.ceil(16e6 * 600e-6));
    });
  },
);
