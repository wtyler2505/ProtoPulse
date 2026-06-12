import { PinState } from 'avr8js';
import { describe, expect, it } from 'vitest';

import {
  BRLO,
  BRNE,
  CBI,
  CPI,
  DEC,
  IN,
  IO,
  LDI,
  LDS,
  MEM,
  OUT,
  RJMP,
  SBI,
  SBRC,
  STS,
  assemble,
} from './asm.js';
import { Atmega328pCore } from './atmega328p.js';

/**
 * The classic blink, hand-assembled (word indices in comments):
 * B5 output, then SBI/CBI around two 200-count busy-wait loops.
 * Period ≈ 1206 cycles: each delay is 199×3 + 2 = 599 cycles, plus
 * SBI/CBI (2 each), LDI (1 each) and RJMP (2).
 */
const BLINK = assemble([
  LDI(16, 0x20), //  0: r16 = 1<<5
  OUT(IO.DDRB, 16), //  1: B5 → output (low)
  SBI(IO.PORTB, 5), //  2: loop — B5 high
  LDI(17, 200), //  3
  DEC(17), //  4: d1
  BRNE(-2), //  5: → 4
  CBI(IO.PORTB, 5), //  6: B5 low
  LDI(17, 200), //  7
  DEC(17), //  8: d2
  BRNE(-2), //  9: → 8
  RJMP(2 - 11), // 10: → 2 (loop)
]);

/** Mirror PIND onto PORTB forever; only B0 is an output. */
const MIRROR = assemble([
  LDI(16, 0x01), // 0
  OUT(IO.DDRB, 16), // 1: B0 → output
  IN(17, IO.PIND), // 2: loop
  OUT(IO.PORTB, 17), // 3
  RJMP(2 - 5), // 4: → 2
]);

/**
 * Transmit "Hi" on USART0. NOTE: real firmware polls UDRE0 between
 * UDR0 writes; avr8js captures every UDR0 write via its TX hook, so
 * back-to-back writes are honest enough for this test.
 */
const UART_TX = assemble([
  LDI(16, 0x08), // TXEN0
  STS(MEM.UCSR0B, 16),
  LDI(17, 0x48), // 'H'
  STS(MEM.UDR0, 17),
  LDI(17, 0x69), // 'i'
  STS(MEM.UDR0, 17),
  RJMP(-1),
]);

/** Enable the USART0 receiver, then idle. */
const UART_RX = assemble([
  LDI(16, 0x10), // RXEN0
  STS(MEM.UCSR0B, 16),
  RJMP(-1),
]);

/** Encode a program image as Intel-HEX text (test fixture builder). */
function toIntelHex(bytes: Uint8Array): string {
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.subarray(offset, Math.min(offset + 16, bytes.length));
    const fields = [chunk.length, (offset >> 8) & 0xff, offset & 0xff, 0x00, ...chunk];
    const sum = fields.reduce((a, b) => a + b, 0);
    fields.push((0x100 - (sum & 0xff)) & 0xff);
    lines.push(`:${fields.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('')}`);
  }
  lines.push(':00000001FF');
  return lines.join('\n');
}

function blinkCore(): Atmega328pCore {
  const core = new Atmega328pCore();
  core.loadFirmware(BLINK);
  return core;
}

describe('Atmega328pCore — basics', () => {
  it('runs at 16 MHz', () => {
    expect(new Atmega328pCore().clockHz).toBe(16_000_000);
  });

  it('inspect() starts at power-on state (SP = RAMEND 0x08FF)', () => {
    const state = new Atmega328pCore().inspect();
    expect(state).toEqual({ pc: 0, cycles: 0, sreg: 0, sp: 0x08ff });
  });

  it('drainUart() is empty before anything transmits', () => {
    expect(new Atmega328pCore().drainUart().length).toBe(0);
  });

  it('rejects firmware larger than the 32 KiB flash', () => {
    expect(() => { new Atmega328pCore().loadFirmware(new Uint8Array(0x8001)); }).toThrow(
      /flash is 32768/,
    );
  });
});

describe('Atmega328pCore — step()', () => {
  it('returns exact cycles on a NOP sled (unprogrammed flash)', () => {
    const core = new Atmega328pCore(); // all-NOP flash, 1 cycle each
    expect(core.step(100).cycles).toBe(100);
    expect(core.step(57).cycles).toBe(57);
    expect(core.inspect().cycles).toBe(157);
  });

  it('overshoots by at most one instruction and reports the true count', () => {
    const core = blinkCore();
    const { cycles } = core.step(1000);
    expect(cycles).toBeGreaterThanOrEqual(1000);
    expect(cycles).toBeLessThanOrEqual(1002); // longest opcode here is 2 cycles
    expect(core.inspect().cycles).toBe(cycles);
  });

  it('rejects a non-positive or fractional cycle budget', () => {
    const core = new Atmega328pCore();
    expect(() => core.step(0)).toThrow(/positive integer/);
    expect(() => core.step(-5)).toThrow(/positive integer/);
    expect(() => core.step(1.5)).toThrow(/positive integer/);
  });
});

describe('Atmega328pCore — blink (GPIO output events)', () => {
  it('emits rising and falling edges on B5 with plausible spacing', () => {
    const core = blinkCore();
    const { events } = core.step(200_000);

    const rising = events.filter((e) => e.level === 1);
    const falling = events.filter((e) => e.level === 0);
    expect(rising.length).toBeGreaterThanOrEqual(2);
    expect(falling.length).toBeGreaterThanOrEqual(2);
    expect(events.every((e) => e.pin === 'B5')).toBe(true);

    // Rising-to-rising spacing ≈ the 1206-cycle loop period.
    for (let i = 1; i < rising.length; i++) {
      const gap = (rising[i]?.cycle ?? Number.NaN) - (rising[i - 1]?.cycle ?? Number.NaN);
      expect(gap).toBeGreaterThan(900);
      expect(gap).toBeLessThan(2000);
    }
  });

  it('stamps events with non-decreasing cycle counts, first edge rising', () => {
    const core = blinkCore();
    const { events } = core.step(10_000);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.level).toBe(1); // SBI before any CBI
    for (let i = 1; i < events.length; i++) {
      expect(events[i]?.cycle ?? Number.NaN).toBeGreaterThanOrEqual(
        events[i - 1]?.cycle ?? Number.NaN,
      );
    }
  });

  it('does not re-deliver drained events on the next step', () => {
    const core = blinkCore();
    const first = core.step(5_000).events;
    const second = core.step(5_000).events;
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    const lastFirst = first[first.length - 1]?.cycle ?? Number.NaN;
    expect(second.every((e) => e.cycle > lastFirst)).toBe(true);
  });
});

describe('Atmega328pCore — setPin (external drive)', () => {
  it('drives the PIN register of an input pin (avr8js pinState stays Input)', () => {
    const core = new Atmega328pCore();
    core.setPin('B4', 1);
    const { cpu, ports } = core.raw();
    expect(ports.B.pinState(4)).toBe(PinState.Input); // DDR untouched
    expect((cpu.data[0x23] ?? 0) & 0x10).toBe(0x10); // PINB bit 4 high
    core.setPin('B4', 0);
    expect((cpu.data[0x23] ?? 0) & 0x10).toBe(0x00);
  });

  it('feeds firmware: PIND mirrored to PORTB produces edges on B0', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(MIRROR);
    core.step(100); // settle: DDRB set, PORTB driven low
    core.setPin('D0', 1);
    const high = core.step(100).events;
    expect(high.some((e) => e.pin === 'B0' && e.level === 1)).toBe(true);
    core.setPin('D0', 0);
    const low = core.step(100).events;
    expect(low.some((e) => e.pin === 'B0' && e.level === 0)).toBe(true);
  });

  it('rejects pin ids outside ports B/C/D bits 0-7', () => {
    const core = new Atmega328pCore();
    expect(() => { core.setPin('A5', 1); }).toThrow(/invalid pin "A5"/);
    expect(() => { core.setPin('B8', 1); }).toThrow(/invalid pin "B8"/);
    expect(() => { core.setPin('13', 1); }).toThrow(/invalid pin "13"/);
  });
});

describe('Atmega328pCore — UART', () => {
  it('captures MCU → host bytes; drain clears the buffer', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(UART_TX);
    core.step(500);
    expect([...core.drainUart()]).toEqual([0x48, 0x69]); // "Hi"
    expect(core.drainUart().length).toBe(0);
  });

  it('delivers a host byte to UDR0 once the firmware enables RXEN', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(UART_RX);
    core.uartWrite(0x55); // queued: receiver not enabled yet
    core.step(2_000); // RXEN set + one char time (160 cycles at UBRR=0)
    const { cpu } = core.raw();
    expect((cpu.data[MEM.UCSR0A] ?? 0) & 0x80).toBe(0x80); // RXC0 set
    expect(cpu.readData(MEM.UDR0)).toBe(0x55);
    expect((cpu.data[MEM.UCSR0A] ?? 0) & 0x80).toBe(0x00); // reading UDR0 clears RXC0
  });

  it('queues back-to-back host bytes and delivers them in order', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(UART_RX);
    core.step(100); // let RXEN take effect
    core.uartWrite(0x11);
    core.uartWrite(0x22);
    const { cpu } = core.raw();
    core.step(200); // first char time elapsed, second still in flight
    expect(cpu.readData(MEM.UDR0)).toBe(0x11);
    core.step(200);
    expect(cpu.readData(MEM.UDR0)).toBe(0x22);
  });

  it('rejects values that are not a byte', () => {
    const core = new Atmega328pCore();
    expect(() => { core.uartWrite(256); }).toThrow(/byte 0\.\.255/);
    expect(() => { core.uartWrite(-1); }).toThrow(/byte 0\.\.255/);
    expect(() => { core.uartWrite(1.5); }).toThrow(/byte 0\.\.255/);
  });
});

describe('Atmega328pCore — reset()', () => {
  it('returns to power-on state but keeps the firmware', () => {
    const core = blinkCore();
    core.step(10_000);
    expect(core.inspect().cycles).toBeGreaterThan(0);

    core.reset();
    expect(core.inspect()).toEqual({ pc: 0, cycles: 0, sreg: 0, sp: 0x08ff });

    // Firmware still there: blink runs again from scratch.
    const { events } = core.step(10_000);
    expect(events.some((e) => e.pin === 'B5' && e.level === 1)).toBe(true);
  });

  it('drops pending UART queues and unread pin events', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(UART_TX);
    core.step(500);
    core.uartWrite(0x99);
    core.reset();
    expect(core.drainUart().length).toBe(0); // TX buffer dropped
    expect(core.step(100).events.length).toBe(0); // event buffer dropped
  });
});

describe('Atmega328pCore — firmware loading formats', () => {
  it('loads Intel-HEX text and runs it', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(toIntelHex(BLINK));
    const { events } = core.step(10_000);
    expect(events.some((e) => e.pin === 'B5' && e.level === 1)).toBe(true);
  });

  it('detects Intel-HEX text handed over as raw bytes', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(new TextEncoder().encode(toIntelHex(BLINK)));
    const { events } = core.step(10_000);
    expect(events.some((e) => e.pin === 'B5' && e.level === 1)).toBe(true);
  });

  it('rejects malformed Intel-HEX text', () => {
    expect(() => { new Atmega328pCore().loadFirmware(':020000000C945F\n:00000001FF'); }).toThrow(
      /checksum mismatch/,
    );
  });
});

describe('Atmega328pCore — timer0', () => {
  it('counts CPU cycles once CS00 (no prescale) is set', () => {
    // LDI r16,1; OUT TCCR0B,r16; idle. TCNT0 then tracks cycles mod 256.
    const program = assemble([LDI(16, 0x01), OUT(IO.TCCR0B, 16), RJMP(-1)]);
    const core = new Atmega328pCore();
    core.loadFirmware(program);
    core.step(100);
    const { cpu } = core.raw();
    expect(cpu.readData(0x46)).toBeGreaterThan(0); // TCNT0 advanced
  });
});

// ── ADC ──────────────────────────────────────────────────────────────

const ADSC = 0x40;
const ADIF = 0x10;
const ADLAR = 0x20;
/** ADEN | ADSC | ADPS=÷4 — one ADC clock = 4 CPU cycles. */
const START_DIV4 = 0xc2;

/**
 * Poke ADMUX/ADCSRA directly (flash stays an all-NOP sled, so step()
 * just burns cycles while the conversion runs).
 */
function startConversion(core: Atmega328pCore, admux: number, adcsra: number): void {
  const { cpu } = core.raw();
  cpu.writeData(MEM.ADMUX, admux);
  cpu.writeData(MEM.ADCSRA, adcsra);
}

/** One full conversion of `volts` on a fresh core; returns ADCL/ADCH. */
function convert(volts: number, admux = 0, aVccVolts?: number): { adcl: number; adch: number } {
  const core = new Atmega328pCore(aVccVolts === undefined ? {} : { aVccVolts });
  core.setAdcSampler(() => volts);
  startConversion(core, admux, START_DIV4);
  core.step(100); // first conversion = 25 ADC clocks × ÷4
  const { cpu } = core.raw();
  return { adcl: cpu.data[MEM.ADCL] ?? 0, adch: cpu.data[MEM.ADCH] ?? 0 };
}

describe('Atmega328pCore — ADC (register-level)', () => {
  it('first conversion takes 25 ADC clocks (datasheet first-conversion cost)', () => {
    const core = new Atmega328pCore();
    core.setAdcSampler(() => 2.5);
    startConversion(core, 0, START_DIV4); // 25 × 4 = 100 CPU cycles
    const { cpu } = core.raw();
    core.step(99);
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADSC).toBe(ADSC); // still converting
    core.step(1);
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADSC).toBe(0);
    expect(core.drainAdcReads()).toEqual([{ channel: 0, cycle: 100 }]);
  });

  it('subsequent conversions take 13 ADC clocks at the configured prescaler', () => {
    const core = new Atmega328pCore();
    core.setAdcSampler(() => 2.5);
    startConversion(core, 0, START_DIV4);
    core.step(100); // first conversion done at cycle 100
    const { cpu } = core.raw();
    cpu.writeData(MEM.ADCSRA, START_DIV4); // restart: 13 × 4 = 52 cycles
    core.step(51);
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADSC).toBe(ADSC);
    core.step(1);
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADSC).toBe(0);
    expect(core.drainAdcReads().map((r) => r.cycle)).toEqual([100, 152]);
  });

  it('honors the ADPS prescaler bits (÷128 → 25 × 128 cycles for the first conversion)', () => {
    const core = new Atmega328pCore();
    startConversion(core, 0, 0xc7); // ADEN | ADSC | ADPS=÷128
    const { cpu } = core.raw();
    core.step(3199);
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADSC).toBe(ADSC);
    core.step(1);
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADSC).toBe(0);
    expect(core.drainAdcReads()).toEqual([{ channel: 0, cycle: 3200 }]);
  });

  it('calls the sampler with the ADMUX channel at the completion cycle, not the start', () => {
    const calls: { channel: number; cycle: number }[] = [];
    const core = new Atmega328pCore();
    core.setAdcSampler((channel, cycle) => {
      calls.push({ channel, cycle });
      return 1;
    });
    startConversion(core, 3, START_DIV4); // channel 3, started at cycle 0
    core.step(100);
    expect(calls).toEqual([{ channel: 3, cycle: 100 }]);
  });

  it('quantizes the rails exactly: 0 V → 0, 5 V → 1023', () => {
    expect(convert(0)).toEqual({ adcl: 0x00, adch: 0x00 });
    expect(convert(5)).toEqual({ adcl: 0xff, adch: 0x03 }); // 1023
  });

  it('quantizes the 2.5 V midpoint to 512 (round-half-up of 511.5; 511 equally defensible)', () => {
    expect(convert(2.5)).toEqual({ adcl: 0x00, adch: 0x02 }); // 512
  });

  it('clamps out-of-range voltages to the rails', () => {
    expect(convert(7.3)).toEqual({ adcl: 0xff, adch: 0x03 }); // 1023
    expect(convert(-2)).toEqual({ adcl: 0x00, adch: 0x00 });
  });

  it('left-adjusts the result when ADLAR is set', () => {
    expect(convert(5, ADLAR)).toEqual({ adcl: 0xc0, adch: 0xff }); // 1023 << 6
    expect(convert(2.5, ADLAR)).toEqual({ adcl: 0x00, adch: 0x80 }); // 512 << 6
  });

  it('scales full-scale to the aVccVolts option (AREF strapped to AVcc)', () => {
    expect(convert(3.3, 0, 3.3)).toEqual({ adcl: 0xff, adch: 0x03 }); // 1023
    expect(convert(1.65, 0, 3.3)).toEqual({ adcl: 0x00, adch: 0x02 }); // 512
  });

  it('rejects a non-positive or non-finite aVccVolts', () => {
    expect(() => new Atmega328pCore({ aVccVolts: 0 })).toThrow(/positive number of volts/);
    expect(() => new Atmega328pCore({ aVccVolts: -5 })).toThrow(/positive number of volts/);
    expect(() => new Atmega328pCore({ aVccVolts: Number.NaN })).toThrow(
      /positive number of volts/,
    );
  });

  it('completion sets ADIF and clears ADSC', () => {
    const core = new Atmega328pCore();
    startConversion(core, 0, START_DIV4);
    const { cpu } = core.raw();
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADIF).toBe(0);
    core.step(100);
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADIF).toBe(ADIF);
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADSC).toBe(0);
  });

  it('drainAdcReads drains: empty before any conversion and after every drain', () => {
    const core = new Atmega328pCore();
    expect(core.drainAdcReads()).toEqual([]);
    startConversion(core, 0, START_DIV4);
    core.step(100);
    core.raw().cpu.writeData(MEM.ADCSRA, START_DIV4);
    core.step(52);
    expect(core.drainAdcReads().map((r) => r.cycle)).toEqual([100, 152]);
    expect(core.drainAdcReads()).toEqual([]);
  });

  it('reset() drops undrained reads but keeps the sampler (bench wiring)', () => {
    const core = new Atmega328pCore();
    core.setAdcSampler(() => 5);
    startConversion(core, 0, START_DIV4);
    core.step(100);
    core.reset();
    expect(core.drainAdcReads()).toEqual([]); // pending read dropped
    startConversion(core, 0, START_DIV4); // sampler still installed
    core.step(100);
    const { cpu } = core.raw();
    expect(cpu.data[MEM.ADCH] ?? 0).toBe(0x03); // 5 V → 1023 again
    expect(core.drainAdcReads()).toEqual([{ channel: 0, cycle: 100 }]);
  });

  it('reads 0 V with no sampler installed, and still records the conversion', () => {
    const core = new Atmega328pCore();
    startConversion(core, 0, START_DIV4);
    core.step(100);
    const { cpu } = core.raw();
    expect(cpu.data[MEM.ADCL] ?? 0).toBe(0);
    expect(cpu.data[MEM.ADCH] ?? 0).toBe(0);
    expect((cpu.data[MEM.ADCSRA] ?? 0) & ADIF).toBe(ADIF);
    expect(core.drainAdcReads()).toEqual([{ channel: 0, cycle: 100 }]);
  });

  it('surfaces a non-finite sampler result as an error from step()', () => {
    const core = new Atmega328pCore();
    core.setAdcSampler(() => Number.NaN);
    startConversion(core, 0, START_DIV4);
    expect(() => core.step(200)).toThrow(/non-finite volts/);
  });
});

/**
 * Bang-bang controller on ADC channel 0 (word indices in comments):
 * start a conversion (ADEN|ADSC, ÷4 prescaler), busy-wait for ADSC to
 * clear, read ADCL then ADCH (left-adjusted, so ADCH is the top 8
 * bits), and drive B5 high when ADCH ≥ 0x80 (half of vref = 2.5 V),
 * low otherwise. Then start the next conversion. Forever.
 */
const BANG_BANG = assemble([
  LDI(16, 0x20), //  0: r16 = 1<<5
  OUT(IO.DDRB, 16), //  1: B5 → output (driven low)
  LDI(16, ADLAR), //  2: ADLAR | MUX=0 → channel 0, left-adjusted
  STS(MEM.ADMUX, 16), //  3-4
  LDI(16, START_DIV4), //  5: loop — ADEN|ADSC|÷4, fresh ADSC each pass
  STS(MEM.ADCSRA, 16), //  6-7: start conversion
  LDS(17, MEM.ADCSRA), //  8-9: wait — poll ADCSRA
  SBRC(17, 6), // 10: ADSC clear? skip the rjmp
  RJMP(8 - 12), // 11: → 8 (still converting)
  LDS(18, MEM.ADCL), // 12-13: read ADCL first (datasheet read order)
  LDS(19, MEM.ADCH), // 14-15: top 8 bits of the result
  CPI(19, 0x80), // 16: compare against the 2.5 V threshold
  BRLO(2), // 17: below → 20 (drive low)
  SBI(IO.PORTB, 5), // 18: at/above → B5 high
  RJMP(1), // 19: → 21 (skip the CBI)
  CBI(IO.PORTB, 5), // 20: B5 low
  RJMP(5 - 22), // 21: → 5 (next conversion)
]);

describe('Atmega328pCore — ADC bang-bang firmware', () => {
  it('toggles B5 as a triangle ramp crosses the CPI threshold both ways', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(BANG_BANG);
    // Triangle: 0 V → 5 V over the first 20k cycles, back to 0 V by
    // 40k. Crosses 2.5 V upward at cycle 10 000, downward at 30 000.
    core.setAdcSampler((_channel, cycle) =>
      cycle < 20_000 ? (cycle / 20_000) * 5 : ((40_000 - cycle) / 20_000) * 5,
    );
    const { events } = core.step(40_000);

    const b5 = events.filter((e) => e.pin === 'B5');
    expect(b5.length).toBe(2); // exactly one rise and one fall
    expect(b5[0]?.level).toBe(1);
    expect(b5[0]?.cycle ?? Number.NaN).toBeGreaterThan(10_000);
    expect(b5[0]?.cycle ?? Number.NaN).toBeLessThan(10_500); // ≈ one loop after crossing
    expect(b5[1]?.level).toBe(0);
    expect(b5[1]?.cycle ?? Number.NaN).toBeGreaterThan(29_900); // quantization edge ≈ 29 996
    expect(b5[1]?.cycle ?? Number.NaN).toBeLessThan(30_500);
  });

  it('never raises B5 while the input stays below the threshold', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(BANG_BANG);
    core.setAdcSampler(() => 1.0);
    const { events } = core.step(20_000);
    expect(events.some((e) => e.pin === 'B5' && e.level === 1)).toBe(false);
  });

  it('honesty readout: records every loop conversion on channel 0, cycles strictly increasing', () => {
    const core = new Atmega328pCore();
    core.loadFirmware(BANG_BANG);
    core.setAdcSampler(() => 4.0);
    core.step(20_000);
    const reads = core.drainAdcReads();
    expect(reads.length).toBeGreaterThan(100); // ~75-cycle loop → ~260 conversions
    expect(reads.every((r) => r.channel === 0)).toBe(true);
    for (let i = 1; i < reads.length; i++) {
      expect(reads[i]?.cycle ?? Number.NaN).toBeGreaterThan(reads[i - 1]?.cycle ?? Number.NaN);
    }
  });
});
