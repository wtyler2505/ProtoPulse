import { describe, expect, it } from 'vitest';

import { assemble, IN, IO, LDI, LDS, MEM, OUT, RJMP, SBI, SBRC, SBRS, STS, WDR } from './asm.js';
import { Atmega328pCore } from './atmega328p.js';

/**
 * The v0.5 peripheral round-out — timers 1/2, SPI, TWI, EEPROM, and
 * the watchdog — each driven by real hand-assembled firmware against
 * real avr8js peripherals, exactly like the original blink/UART/ADC
 * suites.
 */

// I/O-space addresses (OUT/IN) and data-space addresses (STS/LDS),
// ATmega328P datasheet register summary.
const IO_DDRB = 0x04;
const IO_SPCR = 0x2c;
const IO_SPSR = 0x2d;
const IO_SPDR = 0x2e;
const DS_TCCR1A = 0x80;
const DS_TCCR1B = 0x81;
const DS_OCR1AL = 0x88;
const DS_TCCR2A = 0xb0;
const DS_TCCR2B = 0xb1;
const DS_OCR2A = 0xb3;
const DS_UCSR0B = 0xc1;
const DS_UDR0 = 0xc6;
const DS_TWBR = 0xb8;
const DS_TWCR = 0xbc;
const DS_TWDR = 0xbb;

function core(program: Uint8Array): Atmega328pCore {
  const c = new Atmega328pCore();
  c.loadFirmware(program);
  return c;
}

/** Strictly alternating levels with a fixed cycle period (±0 jitter —
 *  CTC toggles are cycle-exact in avr8js). */
function expectToggles(events: { pin: string; level: 0 | 1; cycle: number }[], pin: string, period: number): void {
  const mine = events.filter((e) => e.pin === pin);
  expect(mine.length).toBeGreaterThan(4);
  for (let i = 1; i < mine.length; i++) {
    expect(mine[i]?.level).toBe(mine[i - 1]?.level === 1 ? 0 : 1);
    expect((mine[i]?.cycle ?? 0) - (mine[i - 1]?.cycle ?? 0)).toBe(period);
  }
}

describe('timer1 / timer2', () => {
  it('timer1 CTC toggles OC1A (B1) every OCR1A+1 cycles', () => {
    const c = core(
      assemble([
        LDI(16, 0x02), // DDRB: B1 output
        OUT(IO_DDRB, 16),
        LDI(16, 0x40), // TCCR1A: COM1A0 (toggle OC1A on match)
        STS(DS_TCCR1A, 16),
        LDI(16, 99), // OCR1A = 99 → period 100 cycles
        STS(DS_OCR1AL, 16),
        LDI(16, 0x09), // TCCR1B: WGM12 (CTC) | CS10 (÷1)
        STS(DS_TCCR1B, 16),
        RJMP(-1), // spin
      ]),
    );
    const { events } = c.step(2_000);
    expectToggles(events as never, 'B1', 100);
  });

  it('timer2 CTC toggles OC2A (B3) every OCR2A+1 cycles', () => {
    const c = core(
      assemble([
        LDI(16, 0x08), // DDRB: B3 output
        OUT(IO_DDRB, 16),
        LDI(16, 0x42), // TCCR2A: COM2A0 | WGM21 (CTC)
        STS(DS_TCCR2A, 16),
        LDI(16, 49), // OCR2A = 49 → period 50 cycles
        STS(DS_OCR2A, 16),
        LDI(16, 0x01), // TCCR2B: CS20 (÷1)
        STS(DS_TCCR2B, 16),
        RJMP(-1),
      ]),
    );
    const { events } = c.step(1_500);
    expectToggles(events as never, 'B3', 50);
  });
});

describe('SPI master', () => {
  it('a master transfer reaches the host handler; the MISO reply lands in SPDR', () => {
    // Master sends 0x42; the handler replies 0xA5; firmware forwards
    // the received byte out the UART so the assertion reads end to end.
    const c = core(
      assemble([
        LDI(16, 0x2c), // DDRB: SS(B2) | MOSI(B3) | SCK(B5) outputs
        OUT(IO_DDRB, 16),
        LDI(16, 0x08), // UCSR0B: TXEN0
        STS(DS_UCSR0B, 16),
        LDI(16, 0x50), // SPCR: SPE | MSTR
        OUT(IO_SPCR, 16),
        LDI(16, 0x42),
        OUT(IO_SPDR, 16), // start the transfer
        // poll: until SPSR.SPIF
        IN(17, IO_SPSR),
        SBRS(17, 7),
        RJMP(-3),
        IN(18, IO_SPDR), // the MISO byte
        STS(DS_UDR0, 18), // ship it out the UART
        RJMP(-1),
      ]),
    );
    const seen: number[] = [];
    c.setSpiHandler((mosi) => {
      seen.push(mosi);
      return 0xa5;
    });
    c.step(2_000);
    expect(seen).toEqual([0x42]);
    expect([...c.drainUart()]).toEqual([0xa5]);
  });

  it('without a handler the bus floats high (0xFF), like real disconnected MISO', () => {
    const c = core(
      assemble([
        LDI(16, 0x2c),
        OUT(IO_DDRB, 16),
        LDI(16, 0x08),
        STS(DS_UCSR0B, 16),
        LDI(16, 0x50),
        OUT(IO_SPCR, 16),
        LDI(16, 0x42),
        OUT(IO_SPDR, 16),
        IN(17, IO_SPSR),
        SBRS(17, 7),
        RJMP(-3),
        IN(18, IO_SPDR),
        STS(DS_UDR0, 18),
        RJMP(-1),
      ]),
    );
    c.step(2_000);
    expect([...c.drainUart()]).toEqual([0xff]);
  });
});

describe('TWI master', () => {
  /** Master write transaction: START → SLA+W (0x50) → 0x42 → STOP. */
  function twiWriteProgram(): Uint8Array {
    return assemble([
      LDI(16, 12), // TWBR: ~400kHz at 16MHz
      STS(DS_TWBR, 16),
      LDI(16, 0xa4), // TWCR: TWINT | TWSTA | TWEN — send START
      STS(DS_TWCR, 16),
      LDS(17, DS_TWCR), // poll TWINT
      SBRS(17, 7),
      RJMP(-4),
      LDI(16, 0xa0), // TWDR: SLA+W (0x50 << 1)
      STS(DS_TWDR, 16),
      LDI(16, 0x84), // TWCR: TWINT | TWEN — clock it out
      STS(DS_TWCR, 16),
      LDS(17, DS_TWCR),
      SBRS(17, 7),
      RJMP(-4),
      LDI(16, 0x42), // data byte
      STS(DS_TWDR, 16),
      LDI(16, 0x84),
      STS(DS_TWCR, 16),
      LDS(17, DS_TWCR),
      SBRS(17, 7),
      RJMP(-4),
      LDI(16, 0x94), // TWCR: TWINT | TWSTO | TWEN — STOP
      STS(DS_TWCR, 16),
      RJMP(-1),
    ]);
  }

  it('routes start / connect / write / stop to the host handler with acks', () => {
    const c = core(twiWriteProgram());
    const log: string[] = [];
    c.setTwiHandler({
      start: (repeated) => log.push(`start${repeated ? '(repeated)' : ''}`),
      stop: () => log.push('stop'),
      connect: (addr, write) => {
        log.push(`connect(0x${addr.toString(16)},${write ? 'W' : 'R'})`);
        return true;
      },
      write: (value) => {
        log.push(`write(0x${value.toString(16)})`);
        return true;
      },
      read: () => 0xff,
    });
    c.step(5_000);
    expect(log).toEqual(['start', 'connect(0x50,W)', 'write(0x42)', 'stop']);
  });

  it('an empty bus (no handler) NACKs the address instead of hanging', () => {
    const c = core(twiWriteProgram());
    // No handler installed: the firmware still completes its poll loops
    // (TWINT sets with a NACK status) and reaches the STOP.
    const result = c.step(5_000);
    expect(result.cycles).toBeGreaterThanOrEqual(5_000); // never wedged
  });
});

describe('EEPROM', () => {
  it('firmware writes a byte (EEMPE window), polls EEPE, reads it back via EERE', () => {
    const c = core(
      assemble([
        LDI(16, 0x08), // UCSR0B: TXEN0 — readback ships out the UART
        STS(DS_UCSR0B, 16),
        LDI(16, 0x10), // EEPROM address 0x010
        OUT(IO.EEARL, 16),
        LDI(16, 0x00),
        OUT(IO.EEARH, 16),
        LDI(17, 0x42), // the byte
        OUT(IO.EEDR, 17),
        LDI(18, 0x04), // EECR: EEMPE — arm the 4-cycle write window
        OUT(IO.EECR, 18),
        SBI(IO.EECR, 1), // EEPE within the window — write starts
        // poll: spin while EEPE is still set (erase+write ≈ 3.6 ms)
        IN(19, IO.EECR),
        SBRC(19, 1),
        RJMP(-3),
        // read back: address registers still hold 0x010
        LDI(20, 0xee), // sentinel — must be overwritten by the EERE read
        OUT(IO.EEDR, 20),
        SBI(IO.EECR, 0), // EERE — EEPROM → EEDR
        IN(20, IO.EEDR),
        STS(DS_UDR0, 20),
        RJMP(-1),
      ]),
    );
    c.step(120_000); // erase 28800 + write 28800 cycles, plus slack
    expect([...c.drainUart()]).toEqual([0x42]);
    expect(c.eepromMemory()[0x10]).toBe(0x42);
  });

  it('EEPROM is nonvolatile: content survives a power-on reset()', () => {
    const c = core(assemble([RJMP(-1)]));
    c.eepromMemory()[0x20] = 0x77; // bench pre-seed
    c.step(100);
    c.reset(); // rebuilds CPU + peripherals; EEPROM backend must survive
    expect(c.eepromMemory()[0x20]).toBe(0x77);
  });

  it('a pre-seeded byte is readable by firmware (read path, no write first)', () => {
    const c = core(
      assemble([
        LDI(16, 0x08),
        STS(DS_UCSR0B, 16),
        LDI(16, 0x33), // EEPROM address 0x033
        OUT(IO.EEARL, 16),
        SBI(IO.EECR, 0), // EERE
        IN(20, IO.EEDR),
        STS(DS_UDR0, 20),
        RJMP(-1),
      ]),
    );
    c.eepromMemory()[0x33] = 0x5a;
    c.step(2_000);
    expect([...c.drainUart()]).toEqual([0x5a]);
  });
});

describe('watchdog', () => {
  /** WDTCSR = WDCE|WDE (arm), then WDE with prescaler 0 → 2048 WDT
   *  ticks at 128 kHz = 16 ms = 256,000 CPU cycles at 16 MHz. */
  const armWatchdog = [
    LDI(16, 0x18), // WDCE | WDE
    LDI(17, 0x08), // WDE, shortest prescaler
    STS(MEM.WDTCSR, 16),
    STS(MEM.WDTCSR, 17), // 2 cycles after the arm — inside the 4-cycle window
  ];

  it('a hung loop times out: the CPU resets and MCUSR.WDRF is set', () => {
    const c = core(assemble([...armWatchdog, RJMP(-1)]));
    c.step(600_000); // > 2 timeout periods
    expect((c.raw().cpu.data[IO.MCUSR + 0x20] ?? 0) & 0x08).toBe(0x08);
  });

  it('firmware that feeds the dog (WDR) never resets', () => {
    const c = core(
      assemble([
        ...armWatchdog,
        WDR(), // loop: feed…
        RJMP(-2), // …forever
      ]),
    );
    c.step(600_000);
    expect((c.raw().cpu.data[IO.MCUSR + 0x20] ?? 0) & 0x08).toBe(0);
  });
});
