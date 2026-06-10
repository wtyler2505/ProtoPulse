import { PinState } from 'avr8js';
import { describe, expect, it } from 'vitest';

import { BRNE, CBI, DEC, IN, IO, LDI, MEM, OUT, RJMP, SBI, STS, assemble } from './asm.js';
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
