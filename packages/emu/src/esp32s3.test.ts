import { describe, expect, it } from 'vitest';

import {
  Esp32s3Core,
  ESP32S3_GPIO_BASE,
  ESP32S3_IRAM_BASE,
  ESP32S3_UART0_BASE,
} from './esp32s3.js';
import {
  ADD,
  ADD_N,
  ADDI,
  ADDMI,
  ADDI_N,
  AND,
  assembleXtensa,
  BEQZ,
  BEQZ_N_TO,
  BLT,
  BNE,
  BNEZ,
  BNEZ_TO,
  BR,
  CALL0,
  CALL0_TO,
  CALLN_TO,
  CALLXN,
  ENTRY,
  J,
  J_TO,
  L32I,
  L32I_N,
  L32R,
  MEMW,
  MOV_N,
  MOVI,
  MOVI_N,
  MOVSP,
  NOP,
  NOP_N,
  PAD_TO,
  RET,
  RET_N,
  RETW,
  RETW_N,
  RFE,
  RSIL,
  RSR,
  S32I,
  S32I_N,
  SLLI,
  SR,
  SRAI,
  SRLI,
  SUB,
  WSR,
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
    // ILL.N (0xf06d) — the density space's deliberate illegal
    // instruction, which this core refuses like everything unknown.
    c.loadFirmware(Uint8Array.from([0x6d, 0xf0, 0x00]));
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

describe('Esp32s3Core — 16-bit code-density forms (slice 2)', () => {
  const w16 = (n: { w16: number }): number[] => [n.w16 & 0xff, (n.w16 >> 8) & 0xff];

  it('narrow encodings match the disassembler fixtures exactly', () => {
    expect(w16(RET_N())).toEqual([0x0d, 0xf0]);
    expect(w16(NOP_N())).toEqual([0x3d, 0xf0]);
    expect(MOV_N(0, 0).w16).toBe(0x000d);
    expect(MOVI_N(0, 0).w16 & 0x008f).toBe(0x000c);
    expect(ADD_N(0, 0, 0).w16 & 0x000f).toBe(0x000a);
    expect(L32I_N(0, 0, 0).w16 & 0x000f).toBe(0x0008);
    expect(S32I_N(0, 0, 0).w16 & 0x000f).toBe(0x0009);
  });

  it("MOVI.N covers its asymmetric −32..95 range and MOV.N moves s → t", () => {
    // a2 = 95, a3 = −32 (both ends of the range); a4 = a2 + a3 = 63.
    // Then the MOV.N direction probe: a5 = 7, a6 = 42, MOV.N a6, a5 —
    // if dest/src were transposed, the UART would say 42, not 7.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      MOVI_N(2, 95),
      MOVI_N(3, -32),
      ADD_N(4, 2, 3),
      L32R(7, 0),
      S32I(4, 7, 0x00), // tx 63
      MOVI_N(5, 7),
      MOVI_N(6, 42),
      MOV_N(6, 5),
      S32I(6, 7, 0x00), // tx 7
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([63, 7]);
  });

  it('ADDI.N: t=0 means −1; L32I.N/S32I.N round-trip through DRAM', () => {
    const SCRATCH = 0x3fc88000 + 0x200;
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH], [
      MOVI_N(2, 5),
      ADDI_N(2, 2, -1), // 4
      ADDI_N(2, 2, -1), // 3
      ADDI_N(2, 2, 15), // 18
      L32R(3, 1),
      S32I_N(2, 3, 8), // narrow store
      L32I_N(4, 3, 8), // narrow load back
      L32R(7, 0),
      S32I(4, 7, 0x00), // tx 18
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([18]);
  });

  it('BEQZ.N branches forward over the trap; mixed-width layout resolves', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      L32R(7, 0),
      MOVI_N(2, 0),
      BEQZ_N_TO(2, 5), // taken → skip the trap byte
      MOVI(3, 0x66), // trap: would tx 0x66
      S32I(3, 7, 0x00),
      MOVI_N(4, 90), // target
      S32I(4, 7, 0x00), // tx 90 only
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([90]);
  });

  it('a mixed-width blink: narrow delay loop, index-based jumps, zero jitter', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 7], [
      L32R(2, 0),
      L32R(3, 1),
      S32I(3, 2, 0x24), // enable IO7
      // [3] loop:
      S32I(3, 2, 0x08), // high
      MOVI_N(4, 6),
      ADDI_N(4, 4, -1), // [5] narrow delay body
      BNEZ_TO(4, 5),
      S32I(3, 2, 0x0c), // low
      MOVI_N(4, 6),
      ADDI_N(4, 4, -1), // [9]
      BNEZ_TO(4, 9),
      J_TO(3),
    ]);
    const c = core(image);
    const io7 = c.step(800).events.filter((e) => e.pin === 'IO7');
    expect(io7.length).toBeGreaterThan(8);
    for (let i = 1; i < io7.length; i++) {
      expect(io7[i]?.level).toBe(io7[i - 1]?.level === 1 ? 0 : 1);
    }
    const periods = new Set<number>();
    for (let i = 2; i < io7.length; i++) {
      periods.add((io7[i]?.cycle ?? 0) - (io7[i - 2]?.cycle ?? 0));
    }
    expect(periods.size).toBe(1);
  });

  it('RET.N returns; RETW.N (windowed) refuses loudly', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      MOVI_N(2, 3),
      CALL0_TO(7), // the assembler enforces the 4-aligned target
      L32R(7, 0),
      S32I(2, 7, 0x00),
      J(BR(-1)),
      NOP(),
      NOP(), // pad: code[7] lands at byte 8 + 2+3+3+3+3+3+3 = 28 ✓
      // [7] double:
      ADD_N(2, 2, 2),
      RET_N(),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([6]);

    const d = new Esp32s3Core();
    d.loadFirmware(Uint8Array.from([0x1d, 0xf0])); // RETW.N with a0 = 0
    expect(() => d.step(1)).toThrow('call0-style link');
  });
});

describe('Esp32s3Core — windowed ABI (slice 3)', () => {
  it('ENTRY/RETW byte fixtures match real objdump output', () => {
    // "entry a1, 32" disassembles as "36 41 00".
    expect(word(ENTRY(1, 32))).toEqual([0x36, 0x41, 0x00]);
    expect(word(RETW())).toEqual([0x90, 0x00, 0x00]);
    expect(RETW_N().w16).toBe(0xf01d);
    expect(word(CALLXN(2, 5))).toEqual([0xe0, 0x05, 0x00]);
  });

  it('CALL8/ENTRY rotate the window: args arrive in a2, locals survive', () => {
    // crt0: a2=UART, a3=sentinel 7; a10=arg 5; call8 fn; tx a10 (retval)
    // and a3 (sentinel) — both must survive the callee's window.
    // fn: entry; a2 = arg; a2 += 1; retw → caller sees retval in a10.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      L32R(2, 0),
      MOVI(3, 7),
      MOVI(10, 5),
      CALLN_TO(2, 8), // call8 → fn at code[8] (4-aligned: 8 + 21 + pad)
      S32I(10, 2, 0x00), // tx retval (6)
      S32I(3, 2, 0x00), // tx sentinel (7)
      J(BR(-1)),
      NOP(), // pad: code[8] at byte 8 + 21 + 3 = 32 ✓
      // fn:
      ENTRY(1, 16),
      ADDI(2, 2, 1), // retval = arg + 1
      RETW(),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([6, 7]);
  });

  it('deep CALL8 recursion forces spills and fills; every frame survives', () => {
    // rec(d): if d==0 return 0; r = rec(d-1); tx own depth; return d + r.
    // Depth 12 → 14 live frames × 8 regs ≫ 64 physical: multiple
    // overflow spills on the way down, underflow fills on the way up.
    // The tx sequence proves each frame's saved register (a3) and the
    // crt0 frame's UART pointer (a2) round-tripped through memory.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      // crt0:
      L32R(2, 0), // a2 = UART
      ADDI(3, 1, -16),
      S32I(1, 3, 4), // [sp−12] ← sp: init the base save area like crt0 must
      MOVI(10, 12), // arg
      CALLN_TO(2, 8), // call8 rec
      S32I(10, 2, 0x00), // tx total (78) through crt0's restored a2
      J(BR(-1)),
      NOP(), // pad: rec at code[8] = byte 8 + 24 = 32 ✓
      // rec: frame 32 — a call8-making function must reserve 16 bytes
      // of base save area PLUS 16 for its callee's extra save area
      // (the ABI rule behind the canonical "entry a1, 32").
      ENTRY(1, 32),
      MOV_N(3, 2), // a3 = depth (this frame's sentinel)
      BNEZ_TO(2, 13),
      MOVI(2, 0), // base case: return 0
      RETW(),
      // [13] recurse:
      ADDI(10, 2, -1),
      CALLN_TO(2, 8),
      L32R(7, 0), // a7 = UART (fresh in this window)
      S32I(3, 7, 0x00), // tx own depth — only correct if a3 survived
      ADD(2, 3, 10), // return depth + child sum
      RETW_N(), // narrow return on the unwind path
    ]);
    const c = core(image);
    c.step(2_000);
    expect([...c.drainUart()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 78]);
  });

  it('CALLX8 calls through a register; RETW frame-size mismatch refuses', () => {
    const fnAddr = ESP32S3_IRAM_BASE + 12 + 24; // 2 literals → code at 12; code[8] = byte 36 (4-aligned)
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, fnAddr], [
      L32R(2, 0),
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(4, 1), // fn address
      MOVI(10, 41),
      CALLXN(2, 4), // call8 via a4
      S32I(10, 2, 0x00), // tx 42
      J(BR(-1)),
      // fn:
      ENTRY(1, 16),
      ADDI(2, 2, 1),
      RETW(),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([42]);
  });
});

describe('Esp32s3Core — exceptions + level-1 interrupts (slice 4)', () => {
  const SCRATCH = 0x3fc88000 + 0x400;

  it('RSR/WSR round-trip; CCOUNT advances exactly one per instruction', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, 0x1234], [
      L32R(2, 0),
      L32R(3, 1),
      WSR(3, SR.VECBASE),
      RSR(4, SR.VECBASE),
      S32I(4, 2, 0x00), // tx 0x34 (low byte of the round-tripped value)
      RSR(5, SR.CCOUNT),
      NOP(),
      NOP(),
      NOP(),
      RSR(6, SR.CCOUNT),
      SUB(6, 6, 5), // exactly 4 instructions between the reads
      S32I(6, 2, 0x00),
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([0x34, 4]);
  });

  it('the CCOMPARE0 timer interrupt vectors, the handler re-arms, main counts 3 ticks', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH, ESP32S3_IRAM_BASE], [
      // main:
      L32R(2, 0), // a2 = UART
      L32R(3, 1), // a3 = SCRATCH
      MOVI(4, 0),
      S32I(4, 3, 0), // counter = 0
      L32R(5, 2),
      WSR(5, SR.VECBASE), // vectors at the image base (1KB-aligned)
      MOVI(6, 64), // 1 << 6 — the timer0 line
      WSR(6, SR.INTENABLE),
      RSR(7, SR.CCOUNT),
      ADDMI(7, 7, 256),
      WSR(7, SR.CCOMPARE0),
      RSIL(8, 0), // unmask (reset leaves INTLEVEL = 15)
      // loop until counter == 3:
      MOVI(9, 3),
      L32I(4, 3, 0), // [13]
      BNE(4, 9, BR(-2)),
      S32I(4, 2, 0x00), // tx 3
      J(BR(-1)),
      // the level-1 user vector lives at VECBASE + 0x340:
      PAD_TO(0x340),
      WSR(2, SR.EXCSAVE1), // save a2 the architectural way
      L32R(2, 1), // a2 = SCRATCH (L32R reaches backward ✓)
      S32I(3, 2, 8), // save a3 to scratch
      L32I(3, 2, 0),
      ADDI(3, 3, 1),
      S32I(3, 2, 0), // counter++
      RSR(3, SR.CCOMPARE0),
      ADDMI(3, 3, 256),
      WSR(3, SR.CCOMPARE0), // re-arm — also CLEARS the pending bit
      L32I(3, 2, 8), // restore a3
      RSR(2, SR.EXCSAVE1), // restore a2
      RFE(),
    ]);
    const c = core(image);
    c.step(2_000);
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('RSIL masks a pending interrupt; lowering INTLEVEL delivers it', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH, ESP32S3_IRAM_BASE], [
      L32R(2, 0),
      L32R(3, 1),
      MOVI(4, 0),
      S32I(4, 3, 0),
      L32R(5, 2),
      WSR(5, SR.VECBASE),
      MOVI(6, 64),
      WSR(6, SR.INTENABLE),
      RSR(7, SR.CCOUNT),
      ADDI(7, 7, 20),
      WSR(7, SR.CCOMPARE0), // fires soon — but INTLEVEL is still 15
      // burn well past the match while masked:
      MOVI(8, 30),
      ADDI(8, 8, -1),
      BNEZ(8, BR(-2)),
      L32I(4, 3, 0),
      S32I(4, 2, 0x00), // tx 0 — latched but not delivered
      RSIL(8, 0), // unmask → delivers immediately
      NOP(),
      L32I(4, 3, 0),
      S32I(4, 2, 0x00), // tx 1
      J(BR(-1)),
      PAD_TO(0x340),
      WSR(2, SR.EXCSAVE1),
      L32R(2, 1),
      S32I(3, 2, 8),
      L32I(3, 2, 0),
      ADDI(3, 3, 1),
      S32I(3, 2, 0),
      RSR(3, SR.CCOMPARE0),
      ADDMI(3, 3, 7936), // re-arm far away — one tick only
      WSR(3, SR.CCOMPARE0),
      L32I(3, 2, 8),
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(500);
    expect([...c.drainUart()]).toEqual([0, 1]);
  });

  it('unimplemented special registers refuse loudly', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [], [RSR(2, 99), J(BR(-1))]);
    const c = core(image);
    expect(() => c.step(5)).toThrow('unimplemented special register 99');
  });
});

describe('Esp32s3Core — peripheral interrupt lines through the matrix (slice 6)', () => {
  const SCRATCH = 0x3fc88000 + 0x800;
  const INTMTX = 0x600c2000;
  // GPIO_PINn config values (INT_TYPE [9:7], INT_ENA bit 13):
  const PIN_POSEDGE = (1 << 7) | (1 << 13);
  const PIN_HIGH_LEVEL = (5 << 7) | (1 << 13);

  it('a rising-edge GPIO interrupt vectors through the matrix; falling edges do not', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH, ESP32S3_IRAM_BASE, GPIO, PIN_POSEDGE, INTMTX], [
      L32R(2, 0), // a2 = UART
      L32R(3, 1), // a3 = SCRATCH
      MOVI(4, 0),
      S32I(4, 3, 0), // counter = 0
      L32R(5, 2),
      WSR(5, SR.VECBASE),
      L32R(5, 3), // a5 = GPIO base
      L32R(6, 4),
      S32I(6, 5, 0x84), // GPIO_PIN4 ← posedge | INT_ENA
      L32R(7, 5), // a7 = interrupt matrix
      MOVI(6, 0),
      S32I(6, 7, 0x40), // GPIO source → CPU line 0
      MOVI(6, 1),
      WSR(6, SR.INTENABLE),
      RSIL(8, 0),
      // wait for counter == 2, settle, re-read — if falling edges
      // wrongly counted, the re-read would say 3:
      MOVI(9, 2),
      L32I(4, 3, 0),
      BNE(4, 9, BR(-2)),
      MOVI(8, 40),
      ADDI(8, 8, -1),
      BNEZ(8, BR(-2)),
      L32I(4, 3, 0),
      S32I(4, 2, 0x00), // tx the settled count
      J(BR(-1)),
      PAD_TO(0x340),
      // handler: counter++, drop the latched edge via STATUS_W1TC.
      WSR(2, SR.EXCSAVE1),
      L32R(2, 1), // a2 = SCRATCH
      S32I(3, 2, 8),
      S32I(4, 2, 12), // main polls in a3/a4 — save both
      L32I(3, 2, 0),
      ADDI(3, 3, 1),
      S32I(3, 2, 0),
      L32R(3, 3), // a3 = GPIO base
      MOVI(4, 1 << 4),
      S32I(4, 3, 0x4c), // STATUS_W1TC
      L32I(4, 2, 12),
      L32I(3, 2, 8),
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(150); // config settles; IO4 idles low
    c.setPin('IO4', 1);
    c.step(100);
    c.setPin('IO4', 0); // falling edge — must NOT count
    c.step(100);
    c.setPin('IO4', 1);
    c.step(400);
    expect([...c.drainUart()]).toEqual([2]);
  });

  it('a high-level GPIO interrupt re-fires after W1TC until the level drops', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH, ESP32S3_IRAM_BASE, GPIO, PIN_HIGH_LEVEL, INTMTX], [
      L32R(2, 0),
      L32R(3, 1),
      MOVI(4, 0),
      S32I(4, 3, 0),
      L32R(5, 2),
      WSR(5, SR.VECBASE),
      L32R(5, 3),
      L32R(6, 4),
      S32I(6, 5, 0x84), // GPIO_PIN4 ← high-level | INT_ENA
      L32R(7, 5),
      MOVI(6, 0),
      S32I(6, 7, 0x40),
      MOVI(6, 1),
      WSR(6, SR.INTENABLE),
      RSIL(8, 0),
      // While IO4 is high the handler starves this loop (the line
      // re-asserts after every W1TC — that is the point); once the
      // host drops the pin, the count must have climbed ≥ 3.
      MOVI(9, 3),
      L32I(4, 3, 0),
      BLT(4, 9, BR(-2)),
      MOVI(4, 0xaa),
      S32I(4, 2, 0x00),
      J(BR(-1)),
      PAD_TO(0x340),
      WSR(2, SR.EXCSAVE1),
      L32R(2, 1),
      S32I(3, 2, 8),
      S32I(4, 2, 12),
      L32I(3, 2, 0),
      ADDI(3, 3, 1),
      S32I(3, 2, 0),
      L32R(3, 3),
      MOVI(4, 1 << 4),
      S32I(4, 3, 0x4c), // W1TC — re-asserts while the level holds
      L32I(4, 2, 12),
      L32I(3, 2, 8),
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(150);
    c.setPin('IO4', 1);
    c.step(600); // handler fires repeatedly; main is starved
    c.setPin('IO4', 0);
    c.step(300); // level gone → main finally runs and reports
    expect([...c.drainUart()]).toEqual([0xaa]);
  });

  it('a fully interrupt-driven UART echo: RXFIFO_FULL wakes the handler per byte', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, ESP32S3_IRAM_BASE, INTMTX], [
      L32R(2, 0), // a2 = UART
      L32R(5, 1),
      WSR(5, SR.VECBASE),
      MOVI(3, 0),
      S32I(3, 2, 0x24), // CONF1: RXFIFO_FULL_THRHD = 0 (any byte)
      MOVI(3, 1),
      S32I(3, 2, 0x0c), // INT_ENA = RXFIFO_FULL
      L32R(7, 2),
      MOVI(3, 1),
      S32I(3, 7, 0x6c), // UART source → CPU line 1
      MOVI(3, 2),
      WSR(3, SR.INTENABLE),
      RSIL(8, 0),
      J(BR(-1)), // main does NOTHING — the echo is all interrupts
      PAD_TO(0x340),
      // main is parked and reads no registers, so a3 needs no save.
      WSR(2, SR.EXCSAVE1),
      L32R(2, 0),
      L32I(3, 2, 0x00), // FIFO read — draining deasserts the line
      S32I(3, 2, 0x00), // echo
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(100);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWrite(0x77);
    c.step(100);
    expect([...c.drainUart()]).toEqual([0x77]);
    c.uartWrite(0x55); // the line must re-assert for a second byte
    c.step(100);
    expect([...c.drainUart()]).toEqual([0x55]);
  });
});

describe('Esp32s3Core — SAR ADC1 oneshot (slice 7)', () => {
  const SENS = 0x60008800;
  // SENS_SAR_MEAS1_CTRL2: EN_PAD_FORCE (bit 31) | START_FORCE (bit
  // 18) | channel 3 one-hot in SAR1_EN_PAD ([30:19]) — exactly what
  // adc_oneshot_ll writes — then the START_SAR (bit 17) 0→1 pulse.
  const CTRL_CH3 = (0x80000000 | (1 << 18) | (1 << (19 + 3))) >>> 0;
  const CTRL_CH3_START = (CTRL_CH3 | (1 << 17)) >>> 0;

  const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SENS, CTRL_CH3, CTRL_CH3_START, 0xfff], [
    L32R(2, 0), // a2 = UART
    L32R(3, 1), // a3 = SENS
    L32R(4, 2),
    S32I(4, 3, 0x0c), // start low (the adc_ll pulse's first half)
    L32R(4, 3),
    S32I(4, 3, 0x0c), // start 0→1 — the conversion runs
    L32I(5, 3, 0x0c), // poll MEAS1_DONE_SAR (bit 16)
    SRAI(6, 5, 16), // SRLI tops out at 15; the AND below drops sign fill
    MOVI(7, 1),
    AND(6, 6, 7),
    BEQZ(6, BR(-5)),
    L32R(7, 4), // 0xfff — MEAS1_DATA_SAR is the low 12 bits
    AND(5, 5, 7),
    S32I(5, 2, 0x00), // tx data & 0xff
    SRLI(5, 5, 8),
    S32I(5, 2, 0x00), // tx data >> 8
    J(BR(-1)),
  ]);

  it('an analogRead-style conversion round-trips through the sampler', () => {
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 3 ? 1.65 : 0));
    c.step(120);
    // round(1.65 / 3.3 × 4095) = 2048 → bytes [0x00, 0x08].
    expect([...c.drainUart()]).toEqual([0x00, 0x08]);
    const reads = c.drainAdcReads();
    expect(reads.length).toBe(1);
    expect(reads[0]?.channel).toBe(3);
    expect(reads[0]?.cycle).toBeGreaterThan(0);
    expect(c.drainAdcReads()).toEqual([]); // drained means drained
  });

  it('without a sampler every conversion reads 0 V — and still logs', () => {
    const c = core(image);
    c.step(120);
    expect([...c.drainUart()]).toEqual([0, 0]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([3]);
  });
});

describe('Esp32s3Core — MOVSP + ESP-IDF app images (slice 5)', () => {
  const SCRATCH = 0x3fc88000 + 0x600;

  /**
   * Build an esptool-shaped app image: 24-byte header (magic 0xE9,
   * segment count, entry @4, chip_id @12), the segments, and the XOR
   * checksum (seed 0xEF) as the last byte of the 16-byte-aligned body.
   */
  function buildEspImage(
    entry: number,
    segs: { addr: number; data: Uint8Array }[],
    opts: { chipId?: number; corruptChecksum?: boolean } = {},
  ): Uint8Array {
    const bytes: number[] = new Array<number>(24).fill(0);
    bytes[0] = 0xe9;
    bytes[1] = segs.length;
    bytes[2] = 0x02; // spi_mode DIO — the loader ignores flash fields
    for (let i = 0; i < 4; i++) bytes[4 + i] = (entry >>> (8 * i)) & 0xff;
    const chipId = opts.chipId ?? 9;
    bytes[12] = chipId & 0xff;
    bytes[13] = (chipId >> 8) & 0xff;
    let checksum = 0xef;
    for (const seg of segs) {
      for (let i = 0; i < 4; i++) bytes.push((seg.addr >>> (8 * i)) & 0xff);
      for (let i = 0; i < 4; i++) bytes.push((seg.data.length >>> (8 * i)) & 0xff);
      for (const b of seg.data) {
        bytes.push(b);
        checksum ^= b;
      }
    }
    const total = Math.ceil((bytes.length + 1) / 16) * 16;
    while (bytes.length < total) bytes.push(0);
    bytes[total - 1] = opts.corruptChecksum ? checksum ^ 0xff : checksum;
    return Uint8Array.from(bytes);
  }

  it('boots a two-segment app image (code → IRAM, data → DRAM) at its entry point', () => {
    // The code segment deliberately does NOT sit at the IRAM base —
    // the entry_addr field has to be honored for this to run at all.
    const codeBase = ESP32S3_IRAM_BASE + 0x100;
    const code = assembleXtensa(codeBase, [UART, SCRATCH], [
      L32R(2, 0),
      L32R(3, 1),
      L32I(4, 3, 0), // read the data segment's payload
      S32I(4, 2, 0x00), // tx it
      J(BR(-1)),
    ]);
    const image = buildEspImage(codeBase, [
      { addr: codeBase, data: code },
      { addr: SCRATCH, data: Uint8Array.from([0x5a, 0, 0, 0]) },
    ]);
    const c = core(image);
    expect(c.inspect().pc).toBe(codeBase);
    c.step(30);
    expect([...c.drainUart()]).toEqual([0x5a]);
    // reset() reloads every segment and restarts at the entry point.
    c.reset();
    c.step(30);
    expect([...c.drainUart()]).toEqual([0x5a]);
  });

  it('refuses wrong-chip, flash-mapped, and corrupted images with clear messages', () => {
    const c = new Esp32s3Core();
    const seg = { addr: ESP32S3_IRAM_BASE, data: Uint8Array.from([0x0d, 0xf0, 0x00, 0x00]) };
    expect(() => {
      c.loadFirmware(buildEspImage(ESP32S3_IRAM_BASE, [seg], { chipId: 0 }));
    }).toThrow('targets ESP32 (chip_id 0)');
    expect(() => {
      c.loadFirmware(buildEspImage(ESP32S3_IRAM_BASE, [{ addr: 0x42000000, data: Uint8Array.from([1, 2, 3, 4]) }]));
    }).toThrow('flash-mapped or unmapped');
    expect(() => {
      c.loadFirmware(buildEspImage(ESP32S3_IRAM_BASE, [seg], { corruptChecksum: true }));
    }).toThrow('checksum mismatch');
  });

  it("MOVSP with the caller's frame live is a plain stack-pointer move", () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      // crt0:
      CALLN_TO(2, 4), // call8 fn — idx 4 lands at byte 8 + 12 = 20 ✓
      J(BR(-1)),
      NOP(),
      NOP(),
      // fn:
      ENTRY(1, 16),
      L32R(2, 0), // a2 = UART
      MOV_N(3, 1), // a3 = old sp
      MOVI(4, 0x77),
      ADDI(5, 1, -16),
      S32I(4, 5, 0), // marker below the OLD sp
      ADDI(6, 1, -32),
      MOVSP(1, 6), // caller's frame is live → plain move, NO copy
      SUB(7, 3, 1),
      S32I(7, 2, 0x00), // tx 32 — sp really moved
      ADDI(5, 1, -16),
      L32I(4, 5, 0),
      S32I(4, 2, 0x00), // tx 0 — the save area was NOT copied
      RETW(),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([32, 0]);
  });

  it('MOVSP with the callers hidden performs the Alloca save-area move', () => {
    // crt0 (wb 0) → call8 main (wb 2) → call8 fn (wb 4): WindowStart
    // is 0b10101 = 21. fn clears main's bit (WSR 17) so all three WS
    // bits below it read 0 — the RM's AllocaCause condition — then
    // MOVSP must move the 4-word base save area to below the new sp.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      // crt0:
      ADDI(3, 1, -16),
      S32I(1, 3, 4), // [sp−12] ← sp
      CALLN_TO(2, 4), // call8 main — byte 8 + 12 = 20 ✓
      J(BR(-1)),
      // main:
      ENTRY(1, 32),
      CALLN_TO(2, 8), // call8 fn — byte 8 + 24 = 32 ✓
      RETW(),
      NOP(),
      // fn:
      ENTRY(1, 16),
      L32R(2, 0), // a2 = UART
      ADDI(4, 1, -16),
      MOVI(5, 0x11),
      S32I(5, 4, 0),
      MOVI(5, 0x44),
      S32I(5, 4, 12), // markers at [sp−16] and [sp−4]
      RSR(6, SR.WINDOWSTART),
      S32I(6, 2, 0x00), // tx 21 — three live frames, as constructed
      MOVI(7, 17), // keep bits {0,4}: hide main's frame
      WSR(7, SR.WINDOWSTART),
      ADDI(8, 1, -32),
      MOVSP(1, 8), // alloca path: copy [old sp−16..−4] → [new sp−16..−4]
      ADDI(4, 1, -16),
      L32I(9, 4, 0),
      S32I(9, 2, 0x00), // tx 0x11 — moved
      L32I(9, 4, 12),
      S32I(9, 2, 0x00), // tx 0x44 — moved
      MOVI(7, 21), // restore so RETW unwinds without a bogus fill
      WSR(7, SR.WINDOWSTART),
      RETW(),
    ]);
    const c = core(image);
    c.step(120);
    expect([...c.drainUart()]).toEqual([21, 0x11, 0x44]);
  });
});
