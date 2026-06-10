import { describe, expect, it, vi } from 'vitest';

import {
  appendBounded,
  createEmuSession,
  decodeAscii,
  FRAME_WALL_BUDGET_MS,
  frameChunkSize,
  frameCycleBudget,
  RING_CAP,
  UART_CAP,
} from './runner.js';

import type { DigitalLevel, EmuModule, McuCore, PinEvent } from './types.js';

/** A scripted fake core — the real @protopulse/emu is NEVER imported here. */
interface FakeCoreOpts {
  clockHz?: number;
  /** Per-step result; default consumes all offered cycles with no events. */
  onStep?: (maxCycles: number, cycleBase: number) => { cycles: number; events: PinEvent[] };
  /** Bytes returned by successive drainUart() calls. */
  uartChunks?: Uint8Array[];
  /** Makes loadFirmware throw (bad hex). */
  failLoad?: string;
}

class FakeCore implements McuCore {
  readonly clockHz: number;
  stepCalls: number[] = [];
  written: number[] = [];
  pinPokes: { pin: string; level: DigitalLevel }[] = [];
  resets = 0;
  loads: (Uint8Array | string)[] = [];
  private cycle = 0;
  private readonly opts: FakeCoreOpts;

  constructor(opts: FakeCoreOpts = {}) {
    this.opts = opts;
    this.clockHz = opts.clockHz ?? 16_000_000;
  }

  loadFirmware(hex: Uint8Array | string): void {
    if (this.opts.failLoad !== undefined) throw new Error(this.opts.failLoad);
    this.loads.push(hex);
  }

  step(maxCycles: number): { cycles: number; events: PinEvent[] } {
    this.stepCalls.push(maxCycles);
    const res = this.opts.onStep?.(maxCycles, this.cycle) ?? { cycles: maxCycles, events: [] };
    this.cycle += res.cycles;
    return res;
  }

  setPin(pin: string, level: DigitalLevel): void {
    this.pinPokes.push({ pin, level });
  }

  uartWrite(byte: number): void {
    this.written.push(byte);
  }

  drainUart(): Uint8Array {
    return this.opts.uartChunks?.shift() ?? new Uint8Array(0);
  }

  inspect() {
    return { pc: 2, cycles: this.cycle, sreg: 0x80, sp: 0x08ff };
  }

  reset(): void {
    this.resets += 1;
    this.cycle = 0;
  }
}

function sessionWith(core: FakeCore, now?: () => number) {
  // The pinned contract is `new Atmega328pCore()`; the fake "class" is a
  // constructor function that hands back the scripted core instead.
  const Atmega328pCore = function (this: unknown) {
    return core;
  } as unknown as new () => McuCore;
  const loader = vi.fn(() => Promise.resolve({ Atmega328pCore } as Partial<EmuModule>));
  return { session: createEmuSession({ loader, ...(now ? { now } : {}) }), loader };
}

const HEX = ':00000001FF';

describe('frame budget math', () => {
  it('targets ~clockHz/60 cycles per frame, never below 1', () => {
    expect(frameCycleBudget(16_000_000)).toBe(266_667);
    expect(frameCycleBudget(60)).toBe(1);
    expect(frameCycleBudget(1)).toBe(1);
  });

  it('chunks the budget so the wall clock is checked ~10× per frame', () => {
    expect(frameChunkSize(16_000_000)).toBe(26_667);
    expect(frameChunkSize(60_000)).toBe(100);
    expect(frameChunkSize(10)).toBe(1);
  });
});

describe('createEmuSession — load', () => {
  it('lazily boots the core once and reports the clock on success', async () => {
    const core = new FakeCore({ clockHz: 8_000_000 });
    const { session, loader } = sessionWith(core);

    expect(session.loaded).toBe(false);
    expect(session.clockHz).toBeNull();
    const out = await session.load(HEX);
    expect(out).toEqual({ ok: true, clockHz: 8_000_000 });
    expect(session.loaded).toBe(true);
    expect(core.loads).toEqual([HEX]);
    expect(core.resets).toBe(1); // reset before loading firmware

    await session.load(HEX);
    expect(loader).toHaveBeenCalledTimes(1); // module + core reused
  });

  it('surfaces a friendly error while @protopulse/emu is not in the build', async () => {
    const session = createEmuSession({ loader: () => Promise.resolve({}) });
    const out = await session.load(HEX);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/not available yet/);
    expect(session.loaded).toBe(false);
  });

  it('surfaces bad-hex loadFirmware throws as error values', async () => {
    const core = new FakeCore({ failLoad: 'bad Intel-HEX record at line 3' });
    const { session } = sessionWith(core);
    const out = await session.load('garbage');
    expect(out).toEqual({ ok: false, error: 'bad Intel-HEX record at line 3' });
    expect(session.loaded).toBe(false);
    expect(session.runFrame()).toEqual({ cycles: 0, events: 0 });
  });

  it('a re-load clears cycles, events, and serial from the previous run', async () => {
    const core = new FakeCore({
      clockHz: 600,
      onStep: (max, base) => ({ cycles: max, events: [{ pin: 'PB5', level: 1, cycle: base + 1 }] }),
      uartChunks: [new Uint8Array([104, 105])],
    });
    const { session } = sessionWith(core);
    await session.load(HEX);
    session.runFrame();
    expect(session.cycles).toBeGreaterThan(0);
    expect(session.events.length).toBeGreaterThan(0);
    expect(session.serialText).toBe('hi');

    await session.load(HEX);
    expect(session.cycles).toBe(0);
    expect(session.events).toHaveLength(0);
    expect(session.serialText).toBe('');
    expect(session.pins()).toEqual([]);
  });
});

describe('createEmuSession — runFrame budget', () => {
  it('consumes exactly the frame budget when the core keeps up', async () => {
    const core = new FakeCore({ clockHz: 60_000 }); // budget 1000, chunk 100
    const { session } = sessionWith(core, () => 0); // wall clock never advances
    await session.load(HEX);

    const res = session.runFrame();
    expect(res.cycles).toBe(1000);
    expect(core.stepCalls).toHaveLength(10);
    expect(core.stepCalls.every((c) => c === 100)).toBe(true);
    expect(session.cycles).toBe(1000);

    session.runFrame();
    expect(session.cycles).toBe(2000); // cycles accumulate across frames
  });

  it('never offers the core more than the remaining budget', async () => {
    // Core advances at most 30 cycles per call: the final chunk shrinks
    // to the 10 cycles left of the 1000-cycle budget instead of 100.
    const core = new FakeCore({
      clockHz: 60_000,
      onStep: (max) => ({ cycles: Math.min(30, max), events: [] }),
    });
    const { session } = sessionWith(core, () => 0);
    await session.load(HEX);
    const res = session.runFrame();
    expect(res.cycles).toBe(1000);
    expect(core.stepCalls.at(-1)).toBe(10);
    for (const offered of core.stepCalls) {
      expect(offered).toBeLessThanOrEqual(100);
    }
  });

  it('stops at the wall-time cap with the budget unfinished', async () => {
    const core = new FakeCore({ clockHz: 60_000 }); // budget 1000, chunk 100
    let t = 0;
    // Every clock read advances 5ms: deadline t=8 is crossed after 2 chunks.
    const { session } = sessionWith(core, () => (t += 5));
    await session.load(HEX);

    const res = session.runFrame();
    expect(res.cycles).toBe(200);
    expect(res.cycles).toBeLessThan(frameCycleBudget(60_000));
    expect(core.stepCalls).toHaveLength(2);
  });

  it('stops immediately when a halted core makes no progress', async () => {
    const core = new FakeCore({ clockHz: 60_000, onStep: () => ({ cycles: 0, events: [] }) });
    const { session } = sessionWith(core, () => 0);
    await session.load(HEX);
    const res = session.runFrame();
    expect(res).toEqual({ cycles: 0, events: 0 });
    expect(core.stepCalls).toHaveLength(1); // no spin
  });

  it('is a no-op before a successful load', () => {
    const { session } = sessionWith(new FakeCore());
    expect(session.runFrame()).toEqual({ cycles: 0, events: 0 });
  });

  it('exposes the wall budget the panel relies on', () => {
    expect(FRAME_WALL_BUDGET_MS).toBe(8);
  });
});

describe('createEmuSession — pin-event ring', () => {
  it('accumulates events in order and reports pins seen, sorted', async () => {
    const script: PinEvent[][] = [
      [
        { pin: 'PB5', level: 1, cycle: 10 },
        { pin: 'PD3', level: 1, cycle: 20 },
      ],
      [{ pin: 'PB5', level: 0, cycle: 30 }],
    ];
    const core = new FakeCore({
      clockHz: 60, // budget 1, chunk 1 → one step per frame
      onStep: (max) => ({ cycles: max, events: script.shift() ?? [] }),
    });
    const { session } = sessionWith(core, () => 0);
    await session.load(HEX);
    session.runFrame();
    session.runFrame();
    expect(session.events.map((e) => e.cycle)).toEqual([10, 20, 30]);
    expect(session.pins()).toEqual(['PB5', 'PD3']);
  });

  it('bounds the ring to the last RING_CAP events, oldest dropped', async () => {
    // 6 MHz → budget 100k, chunk 10k; one event per cycle = 100k events/frame.
    const core = new FakeCore({
      clockHz: 6_000_000,
      onStep: (max, base) => ({
        cycles: max,
        events: Array.from({ length: max }, (_, i) => ({
          pin: 'PB5',
          level: (i % 2) as DigitalLevel,
          cycle: base + i + 1,
        })),
      }),
    });
    const { session } = sessionWith(core, () => 0);
    await session.load(HEX);
    session.runFrame(); // 100k events — exactly at cap
    expect(session.events).toHaveLength(RING_CAP);
    session.runFrame(); // another 100k — the first frame's fall off
    expect(session.events).toHaveLength(RING_CAP);
    expect(session.events[0]?.cycle).toBe(100_001);
    expect(session.events.at(-1)?.cycle).toBe(200_000);
  });
});

describe('createEmuSession — UART', () => {
  it('accumulates drained UART bytes as ASCII text across frames', async () => {
    const core = new FakeCore({
      clockHz: 60,
      uartChunks: [new Uint8Array([98, 108, 105]), new Uint8Array([110, 107, 10])],
    });
    const { session } = sessionWith(core, () => 0);
    await session.load(HEX);
    session.runFrame();
    expect(session.serialText).toBe('bli');
    session.runFrame();
    expect(session.serialText).toBe('blink\n');
  });

  it('decodes printables, keeps \\n \\r \\t, and replaces the rest', () => {
    expect(decodeAscii(new Uint8Array([72, 105, 10, 13, 9]))).toBe('Hi\n\r\t');
    expect(decodeAscii(new Uint8Array([0, 7, 31, 127, 200]))).toBe('�����');
    expect(decodeAscii(new Uint8Array(0))).toBe('');
  });

  it('bounds the rolling text buffer to the UART_CAP tail', async () => {
    const big = new Uint8Array(40_000).fill(97); // 'a'
    const core = new FakeCore({
      clockHz: 60,
      uartChunks: [big, big, new Uint8Array([122])], // 80k + 'z'
    });
    const { session } = sessionWith(core, () => 0);
    await session.load(HEX);
    session.runFrame();
    session.runFrame();
    session.runFrame();
    expect(session.serialText).toHaveLength(UART_CAP);
    expect(session.serialText.endsWith('z')).toBe(true);
  });

  it('appendBounded keeps the tail when over cap', () => {
    expect(appendBounded('abc', 'def', 4)).toBe('cdef');
    expect(appendBounded('ab', 'cd', 8)).toBe('abcd');
    expect(appendBounded('', 'x'.repeat(10), 3)).toBe('xxx');
  });

  it('sendSerial writes 7-bit char codes into the core, including the LF', async () => {
    const core = new FakeCore();
    const { session } = sessionWith(core);
    session.sendSerial('no'); // before load: dropped
    expect(core.written).toEqual([]);
    await session.load(HEX);
    session.sendSerial('Hi\n');
    expect(core.written).toEqual([72, 105, 10]);
  });
});

describe('createEmuSession — reset & inspect', () => {
  it('reset clears buffers and resets the core but keeps the firmware loaded', async () => {
    const core = new FakeCore({
      clockHz: 60,
      onStep: (max, base) => ({ cycles: max, events: [{ pin: 'PB5', level: 1, cycle: base + 1 }] }),
      uartChunks: [new Uint8Array([65])],
    });
    const { session } = sessionWith(core, () => 0);
    await session.load(HEX);
    session.runFrame();
    expect(session.cycles).toBe(1);

    session.reset();
    expect(core.resets).toBe(2); // load + reset
    expect(session.cycles).toBe(0);
    expect(session.events).toHaveLength(0);
    expect(session.serialText).toBe('');
    expect(session.pins()).toEqual([]);
    expect(session.loaded).toBe(true);
    expect(session.runFrame().cycles).toBe(1); // still runs
  });

  it('setPin forwards to the core only once loaded; inspect passes through', async () => {
    const core = new FakeCore({ clockHz: 60 });
    const { session } = sessionWith(core, () => 0);
    session.setPin('PD2', 1);
    expect(core.pinPokes).toEqual([]);
    expect(session.inspect()).toBeNull();

    await session.load(HEX);
    session.setPin('PD2', 1);
    expect(core.pinPokes).toEqual([{ pin: 'PD2', level: 1 }]);
    session.runFrame();
    expect(session.inspect()).toEqual({ pc: 2, cycles: 1, sreg: 0x80, sp: 0x08ff });
  });
});
