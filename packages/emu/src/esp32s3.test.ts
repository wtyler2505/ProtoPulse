import { describe, expect, it } from 'vitest';

import {
  Esp32s3Core,
  ESP32S3_GPIO_BASE,
  ESP32S3_IRAM_BASE,
  ESP32S3_UART0_BASE,
} from './esp32s3.js';
import {
  ADD,
  ADDI,
  AND,
  assembleXtensa,
  BEQZ,
  BNEZ,
  BR,
  CALL0,
  CALL0_TO,
  J,
  L32I,
  L32R,
  MEMW,
  MOVI,
  NOP,
  RET,
  S32I,
  SLLI,
} from './xtensa-asm.js';

/**
 * The ESP32-S3 v0 suite — real hand-assembled Xtensa machine code
 * against the from-scratch interpreter, exactly like the AVR and
 * RP2040 rigs. The first describe pins the ASSEMBLER's bytes against
 * encodings from the ida-xtensa2 disassembler tables and real objdump
 * listings, so an assembler/interpreter shared bug cannot hide.
 */

const GPIO = ESP32S3_GPIO_BASE;
const UART = ESP32S3_UART0_BASE;

function core(image: Uint8Array): Esp32s3Core {
  const c = new Esp32s3Core();
  c.loadFirmware(image);
  return c;
}

const word = (w: number): number[] => [w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff];

describe('xtensa assembler — byte fixtures from independent sources', () => {
  it('emits the documented encodings exactly', () => {
    expect(word(RET())).toEqual([0x80, 0x00, 0x00]);
    expect(word(NOP())).toEqual([0xf0, 0x20, 0x00]);
    expect(word(MEMW())).toEqual([0xc0, 0x20, 0x00]);
    // movi a2, 63 → "22 a0 3f" (objdump)
    expect(word(MOVI(2, 63))).toEqual([0x22, 0xa0, 0x3f]);
    // l32i a2, a1, 16 → imm8 scaled by 4 → "22 21 04"
    expect(word(L32I(2, 1, 16))).toEqual([0x22, 0x21, 0x04]);
    // Opcode/mask spot checks against the disassembler table.
    expect(ADD(3, 1, 2) & 0xff000f).toBe(0x800000);
    expect(BEQZ(4, 0) & 0xff).toBe(0x16);
    expect(BNEZ(4, 0) & 0xff).toBe(0x56);
    expect(J(0) & 0x3f).toBe(0x06);
    expect(CALL0(0) & 0x3f).toBe(0x05);
  });
});

describe('Esp32s3Core', () => {
  it('blinks IO5 with cycle-exact spacing (W1TS/W1TC through the GPIO matrix)', () => {
    // a2 = GPIO base; enable IO5; loop { W1TS; delay; W1TC; delay }
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 5], [
      L32R(2, 0), // a2 = GPIO_BASE
      L32R(3, 1), // a3 = bit 5
      S32I(3, 2, 0x24), // ENABLE_W1TS
      // loop:
      S32I(3, 2, 0x08), // OUT_W1TS → high
      MOVI(4, 10),
      ADDI(4, 4, -1), //   delay: 10 × (ADDI+BNEZ)
      BNEZ(4, BR(-2)),
      S32I(3, 2, 0x0c), // OUT_W1TC → low
      MOVI(4, 10),
      ADDI(4, 4, -1),
      BNEZ(4, BR(-2)),
      J(BR(-9)), // back to loop
    ]);
    const c = core(image);
    const { events } = c.step(1_000);
    const io5 = events.filter((e) => e.pin === 'IO5');
    expect(io5.length).toBeGreaterThan(8);
    // Strict alternation with a constant period (1 instr = 1 cycle).
    for (let i = 1; i < io5.length; i++) {
      expect(io5[i]?.level).toBe(io5[i - 1]?.level === 1 ? 0 : 1);
    }
    const periods = new Set<number>();
    for (let i = 2; i < io5.length; i++) {
      periods.add((io5[i]?.cycle ?? 0) - (io5[i - 2]?.cycle ?? 0));
    }
    expect(periods.size).toBe(1); // zero jitter
  });

  it('mirrors a host-driven input (IO4 → IO6) through GPIO_IN', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 6, 1 << 4], [
      L32R(2, 0),
      L32R(3, 1), // output bit (IO6)
      L32R(5, 2), // input mask (IO4)
      S32I(3, 2, 0x24), // enable IO6
      // loop:
      L32I(4, 2, 0x3c), // GPIO_IN
      AND(4, 4, 5),
      BEQZ(4, BR(2)),
      S32I(3, 2, 0x08), // high
      J(BR(1)),
      S32I(3, 2, 0x0c), // low (BEQZ target)
      J(BR(-7)), // back to loop
    ]);
    const c = core(image);
    c.step(200); // settle: IO4 low → IO6 driven low (no edge yet — first drive)
    c.setPin('IO4', 1);
    const high = c.step(200).events.filter((e) => e.pin === 'IO6');
    expect(high[0]?.level).toBe(1);
    c.setPin('IO4', 0);
    const low = c.step(200).events.filter((e) => e.pin === 'IO6');
    expect(low[0]?.level).toBe(0);
  });

  it('high-bank pins (IO33 via OUT1/ENABLE1) emit events too', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << (33 - 32)], [
      L32R(2, 0),
      L32R(3, 1),
      S32I(3, 2, 0x30), // ENABLE1_W1TS
      S32I(3, 2, 0x14), // OUT1_W1TS
      S32I(3, 2, 0x18), // OUT1_W1TC
      S32I(3, 2, 0x14), // OUT1_W1TS
      J(BR(-1)), // park
    ]);
    const c = core(image);
    const io33 = c.step(100).events.filter((e) => e.pin === 'IO33');
    expect(io33.map((e) => e.level)).toEqual([1, 0, 1]); // first drive (low) isn't an edge
  });

  it('UART0: tx bytes land in drainUart; rx echoes through STATUS + FIFO', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      L32R(2, 0),
      MOVI(3, 0x48), // 'H'
      S32I(3, 2, 0x00), // FIFO ← tx
      MOVI(3, 0x69), // 'i'
      S32I(3, 2, 0x00),
      // echo loop: poll RXFIFO_CNT, read FIFO, write it back
      L32I(4, 2, 0x1c), // STATUS
      BEQZ(4, BR(-2)), // nothing yet → re-poll STATUS
      L32I(5, 2, 0x00), // FIFO → byte
      S32I(5, 2, 0x00), // echo
      J(BR(-5)), // back to the STATUS poll
    ]);
    const c = core(image);
    c.step(50);
    expect([...c.drainUart()]).toEqual([0x48, 0x69]);
    c.uartWrite(0x42);
    c.step(50);
    expect([...c.drainUart()]).toEqual([0x42]);
  });

  it('CALL0/RET subroutines work (call0 ABI, a0 link register)', () => {
    // main: a2 = 5; call double twice; tx a2 over UART; park.
    // double: a2 += a2; ret.
    // 1 literal → code starts at byte 8; 'double' must sit 4-aligned:
    // index 8 → 8 + 24 = byte 32. Two NOPs pad it there.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      MOVI(2, 5),
      CALL0_TO(8),
      CALL0_TO(8),
      L32R(6, 0),
      S32I(2, 6, 0x00), // tx the result
      J(BR(-1)), // park
      NOP(),
      NOP(),
      // double:
      ADD(2, 2, 2),
      RET(),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([20]); // 5 doubled twice
  });

  it('SLLI/shift arithmetic and the parked loop never wedge', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      MOVI(2, 3),
      SLLI(3, 2, 4), // a3 = 3 << 4 = 48 = '0'
      L32R(4, 0),
      S32I(3, 4, 0x00), // tx '0'
      J(BR(-1)),
    ]);
    const c = core(image);
    const res = c.step(100);
    expect(res.cycles).toBeGreaterThanOrEqual(100);
    expect([...c.drainUart()]).toEqual([0x30]);
  });

  it('refuses Intel-HEX and unimplemented instructions loudly', () => {
    const c = new Esp32s3Core();
    expect(() => { c.loadFirmware(':10000000'); }).toThrow('RAW machine-code');
    // An ENTRY instruction (windowed ABI, op0=6 n=3 space… use a 16-bit
    // density NOP.N = 0x3d 0xf0 — op0 = 0xd is outside the 24-bit set).
    c.loadFirmware(Uint8Array.from([0x3d, 0xf0, 0x00]));
    expect(() => c.step(1)).toThrow('unimplemented Xtensa instruction');
  });

  it('reset() restarts from power-on; firmware and pin events replay', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 2], [
      L32R(2, 0),
      L32R(3, 1),
      S32I(3, 2, 0x24),
      S32I(3, 2, 0x08),
      S32I(3, 2, 0x0c),
      J(BR(-1)),
    ]);
    const c = core(image);
    const first = c.step(50).events.filter((e) => e.pin === 'IO2').map((e) => e.level);
    c.reset();
    const again = c.step(50).events.filter((e) => e.pin === 'IO2').map((e) => e.level);
    expect(again).toEqual(first);
    expect(c.inspect().cycles).toBe(50);
  });
});
