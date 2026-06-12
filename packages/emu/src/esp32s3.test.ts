import { describe, expect, it } from 'vitest';

import {
  Esp32s3Core,
  ESP32S3_DRAM_BASE,
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
  type XtInstr,
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
  OR,
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

describe('Esp32s3Core — flash-mapped IROM/DROM segments (slice 9)', () => {
  const IROM = 0x42000000;
  const DROM = 0x3c000000;

  it('boots an XIP image: code runs from IROM, consts read from DROM', () => {
    // No SRAM segment at all — code executes in place from the IROM
    // window and pulls a constant from DROM, like a real app image's
    // .flash.text/.flash.rodata. The stack still lives in DRAM.
    const code = assembleXtensa(IROM, [UART, DROM], [
      L32R(2, 0), // a2 = UART
      L32R(3, 1), // a3 = DROM const
      L32I(4, 3, 0),
      S32I(4, 2, 0x00), // tx the flash-resident constant
      J(BR(-1)),
    ]);
    const image = buildEspImage(IROM, [
      { addr: IROM, data: code },
      { addr: DROM, data: Uint8Array.from([0xc3, 0, 0, 0]) },
    ]);
    const c = core(image);
    expect(c.inspect().pc).toBe(IROM);
    c.step(30);
    expect([...c.drainUart()]).toEqual([0xc3]);
    c.reset(); // segments are firmware — they survive
    c.step(30);
    expect([...c.drainUart()]).toEqual([0xc3]);
  });

  it('flash is read-only through the cache; unmapped cache reads refuse', () => {
    // A raw SRAM program that pokes the DROM window must refuse.
    const writer = assembleXtensa(ESP32S3_IRAM_BASE, [DROM], [
      L32R(2, 0),
      MOVI(3, 1),
      S32I(3, 2, 0x00),
    ]);
    const c = core(writer);
    expect(() => c.step(10)).toThrow('read-only through the cache');

    // Reading inside the window but outside any mapped segment.
    const reader = assembleXtensa(ESP32S3_IRAM_BASE, [IROM + 0x100000], [
      L32R(2, 0),
      L32I(3, 2, 0x00),
    ]);
    const d = core(reader);
    expect(() => d.step(10)).toThrow('unmapped flash-cache address');
  });
});

describe('Esp32s3Core — TIMG0 timer 0 (slice 8)', () => {
  const SCRATCH = 0x3fc88000 + 0xa00;
  const TIMG0 = 0x6001f000;
  const INTMTX = 0x600c2000;
  // T0CONFIG: EN (31) | INCREASE (30) | divider 2 in [28:13].
  const CFG_RUN = (0x80000000 | 0x40000000 | (2 << 13)) >>> 0;
  const CFG_PERIODIC = (CFG_RUN | (1 << 29) | (1 << 10)) >>> 0; // + AUTORELOAD + ALARM_EN
  const CFG_ONESHOT = (CFG_RUN | (1 << 10)) >>> 0; // + ALARM_EN only

  it('the counter ticks at APB/divider and latches through UPDATE', () => {
    // Divider 2 → one tick per 6 CPU cycles (240 MHz CPU, 80 MHz
    // APB). Exactly 12 cycles separate the two UPDATE writes, so the
    // latched values differ by exactly 2 regardless of phase.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, TIMG0, CFG_RUN], [
      L32R(2, 0), // a2 = UART
      L32R(3, 1), // a3 = TIMG0
      L32R(4, 2),
      S32I(4, 3, 0x00), // CONFIG: enabled, up, divider 2
      S32I(4, 3, 0x0c), // UPDATE — latch
      L32I(5, 3, 0x04), // a5 = LO
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      S32I(4, 3, 0x0c), // UPDATE again, 12 cycles after the first
      L32I(7, 3, 0x04),
      SUB(7, 7, 5),
      S32I(7, 2, 0x00), // tx 2
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(100);
    expect([...c.drainUart()]).toEqual([2]);
  });

  it('a periodic alarm: autoreload + the gptimer ISR re-arm dance counts 3', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, SCRATCH, ESP32S3_IRAM_BASE, TIMG0, INTMTX, CFG_PERIODIC],
      [
        L32R(2, 0), // a2 = UART
        L32R(3, 1), // a3 = SCRATCH
        MOVI(4, 0),
        S32I(4, 3, 0), // counter = 0
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(6, 3), // a6 = TIMG0
        MOVI(7, 0),
        S32I(7, 6, 0x18), // LOADLO = 0
        S32I(7, 6, 0x1c), // LOADHI = 0
        S32I(7, 6, 0x20), // LOAD — counter ← 0
        MOVI(7, 30),
        S32I(7, 6, 0x10), // ALARMLO = 30 ticks
        MOVI(7, 0),
        S32I(7, 6, 0x14), // ALARMHI = 0
        MOVI(7, 1),
        S32I(7, 6, 0x70), // INT_ENA = T0
        L32R(8, 4),
        MOVI(7, 2),
        S32I(7, 8, 0xc8), // TG_T0 source → CPU line 2
        MOVI(7, 4),
        WSR(7, SR.INTENABLE), // 1 << 2
        L32R(7, 5),
        S32I(7, 6, 0x00), // CONFIG — armed and running
        RSIL(9, 0),
        MOVI(10, 3),
        L32I(4, 3, 0),
        BNE(4, 10, BR(-2)),
        S32I(4, 2, 0x00), // tx 3
        J(BR(-1)),
        PAD_TO(0x340),
        // handler: counter++, INT_CLR, re-arm ALARM_EN — the exact
        // dance gptimer's ISR performs because hardware auto-cleared
        // the alarm. (a5 is dead in main after init — no save.)
        WSR(2, SR.EXCSAVE1),
        L32R(2, 1),
        S32I(3, 2, 8),
        S32I(4, 2, 12),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 3), // a3 = TIMG0
        MOVI(4, 1),
        S32I(4, 3, 0x7c), // INT_CLR = T0
        L32I(4, 3, 0x00),
        MOVI(5, 1 << 10),
        OR(4, 4, 5),
        S32I(4, 3, 0x00), // ALARM_EN back on
        L32I(4, 2, 12),
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(3000);
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('a one-shot alarm fires exactly once — hardware auto-disables it', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, SCRATCH, ESP32S3_IRAM_BASE, TIMG0, INTMTX, CFG_ONESHOT],
      [
        L32R(2, 0),
        L32R(3, 1),
        MOVI(4, 0),
        S32I(4, 3, 0),
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(6, 3),
        MOVI(7, 0),
        S32I(7, 6, 0x18),
        S32I(7, 6, 0x1c),
        S32I(7, 6, 0x20),
        MOVI(7, 30),
        S32I(7, 6, 0x10),
        MOVI(7, 0),
        S32I(7, 6, 0x14),
        MOVI(7, 1),
        S32I(7, 6, 0x70),
        L32R(8, 4),
        MOVI(7, 2),
        S32I(7, 8, 0xc8),
        MOVI(7, 4),
        WSR(7, SR.INTENABLE),
        L32R(7, 5),
        S32I(7, 6, 0x00), // CONFIG — no autoreload this time
        RSIL(9, 0),
        // burn far past the alarm (and past where a second or third
        // firing would land if the auto-disable were missing):
        MOVI(10, 600),
        ADDI(10, 10, -1),
        BNEZ(10, BR(-2)),
        L32I(4, 3, 0),
        S32I(4, 2, 0x00), // tx the count — must be exactly 1
        J(BR(-1)),
        PAD_TO(0x340),
        // handler: counter++, INT_CLR — deliberately NO re-arm.
        WSR(2, SR.EXCSAVE1),
        L32R(2, 1),
        S32I(3, 2, 8),
        S32I(4, 2, 12),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 3),
        MOVI(4, 1),
        S32I(4, 3, 0x7c),
        L32I(4, 2, 12),
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(2500);
    expect([...c.drainUart()]).toEqual([1]);
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

describe('Esp32s3Core — SAR ADC2 oneshot (slice 14)', () => {
  const SENS = 0x60008800;
  // SENS_SAR_MEAS2_CTRL2 mirrors ADC1's pulse/done/data shape. ADC2
  // channel 4 maps to physical GPIO15; the host sampler sees channel
  // 14 so ADC1 channel 4 and ADC2 channel 4 cannot collide.
  const CTRL_ADC2_CH4 = (0x80000000 | (1 << 18) | (1 << (19 + 4))) >>> 0;
  const CTRL_ADC2_CH4_START = (CTRL_ADC2_CH4 | (1 << 17)) >>> 0;

  const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SENS, CTRL_ADC2_CH4, CTRL_ADC2_CH4_START, 0xfff], [
    L32R(2, 0), // a2 = UART
    L32R(3, 1), // a3 = SENS
    L32R(4, 2),
    S32I(4, 3, 0x30), // start low
    L32R(4, 3),
    S32I(4, 3, 0x30), // start 0→1 — the conversion runs
    L32I(5, 3, 0x30), // poll MEAS2_DONE_SAR (bit 16)
    SRAI(6, 5, 16),
    MOVI(7, 1),
    AND(6, 6, 7),
    BEQZ(6, BR(-5)),
    L32R(7, 4), // 0xfff — MEAS2_DATA_SAR is the low 12 bits
    AND(5, 5, 7),
    S32I(5, 2, 0x00),
    SRLI(5, 5, 8),
    S32I(5, 2, 0x00),
    J(BR(-1)),
  ]);

  it('uses the ADC2 register block and a distinct host sampler channel', () => {
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 14 ? 0.825 : 0));
    c.step(120);
    // round(0.825 / 3.3 × 4095) = 1024 → bytes [0x00, 0x04].
    expect([...c.drainUart()]).toEqual([0x00, 0x04]);
    const reads = c.drainAdcReads();
    expect(reads.map((r) => r.channel)).toEqual([14]);
    expect(reads[0]?.cycle).toBeGreaterThan(0);
  });
});

describe('Esp32s3Core — APB_SARADC digital controller (slice 15)', () => {
  const APB_SARADC = 0x60040000;
  const INT_ADC1_DONE = 0x80000000;
  const CTRL_ADC1_LEN1 = 1 << 25; // data_sar_sel, single ADC1, pattern length 1
  const CTRL_ADC1_LEN2 = (1 << 25) | (1 << 15); // sar1_patt_len = 1 -> length 2
  const CTRL2_TIMER_ENABLE = (1 << 24) | (1 << 11);
  const MASK_12BIT = 0xfff;
  const SAR1_PATTERN_CH4 = ((4 << 2) << 18) >>> 0;
  const SAR1_PATTERN_CH2_CH5 = (((2 << 2) << 18) | ((5 << 2) << 12)) >>> 0;

  it('timer-triggered digital ADC1 conversion latches INT_ST and DATA_STATUS', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, APB_SARADC, SAR1_PATTERN_CH4, CTRL_ADC1_LEN1, INT_ADC1_DONE, CTRL2_TIMER_ENABLE, MASK_12BIT],
      [
        L32R(2, 0),
        L32R(3, 1),
        L32R(4, 2),
        S32I(4, 3, 0x18), // SAR1 pattern table item 0 = channel 4
        L32R(4, 3),
        S32I(4, 3, 0x00), // ADC1, one pattern item, type2 output semantics
        L32R(4, 4),
        S32I(4, 3, 0x5c), // enable ADC1_DONE
        L32R(4, 5),
        S32I(4, 3, 0x04), // timer enable triggers one digital conversion
        L32I(5, 3, 0x64), // INT_ST
        SRAI(5, 5, 31),
        MOVI(6, 1),
        AND(5, 5, 6),
        S32I(5, 2, 0x00), // tx done? 1=yes
        L32I(5, 3, 0x40), // ADC1 DATA_STATUS
        L32R(6, 6),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        SRLI(5, 5, 8),
        S32I(5, 2, 0x00),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 4 ? 1.65 : 0));
    c.step(160);
    expect([...c.drainUart()]).toEqual([1, 0x00, 0x08]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([4]);
  });

  it('clearing ADC1_DONE advances the running pattern table', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, APB_SARADC, SAR1_PATTERN_CH2_CH5, CTRL_ADC1_LEN2, INT_ADC1_DONE, CTRL2_TIMER_ENABLE, MASK_12BIT],
      [
        L32R(2, 0),
        L32R(3, 1),
        L32R(4, 2),
        S32I(4, 3, 0x18), // channel 2, then channel 5
        L32R(4, 3),
        S32I(4, 3, 0x00),
        L32R(4, 4),
        S32I(4, 3, 0x5c),
        L32R(4, 5),
        S32I(4, 3, 0x04),
        L32I(5, 3, 0x40),
        L32R(6, 6),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        SRLI(5, 5, 8),
        S32I(5, 2, 0x00),
        L32R(4, 4),
        S32I(4, 3, 0x68), // clear done; timer mode immediately queues next pattern
        L32I(5, 3, 0x40),
        L32R(6, 6),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        SRLI(5, 5, 8),
        S32I(5, 2, 0x00),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 2 ? 0.825 : channel === 5 ? 3.3 : 0));
    c.step(220);
    expect([...c.drainUart()]).toEqual([0x00, 0x04, 0xff, 0x0f]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([2, 5]);
  });
});

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

describe('Esp32s3Core — MOVSP + ESP-IDF app images (slice 5)', () => {
  const SCRATCH = 0x3fc88000 + 0x600;

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

  it('refuses wrong-chip, unmapped-segment, and corrupted images with clear messages', () => {
    const c = new Esp32s3Core();
    const seg = { addr: ESP32S3_IRAM_BASE, data: Uint8Array.from([0x0d, 0xf0, 0x00, 0x00]) };
    expect(() => {
      c.loadFirmware(buildEspImage(ESP32S3_IRAM_BASE, [seg], { chipId: 0 }));
    }).toThrow('targets ESP32 (chip_id 0)');
    expect(() => {
      c.loadFirmware(buildEspImage(ESP32S3_IRAM_BASE, [{ addr: 0x50000000, data: Uint8Array.from([1, 2, 3, 4]) }]));
    }).toThrow('outside the modeled SRAM window and the IROM/DROM cache windows');
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

describe('Esp32s3Core — ROM functions (slice 10)', () => {
  // REAL mask-ROM entry addresses, pinned here independently of the
  // implementation, from esp-idf v5.2:
  //   components/esp_rom/esp32s3/ld/esp32s3.rom.ld
  //   components/esp_rom/esp32s3/ld/esp32s3.rom.newlib.ld
  const ETS_PRINTF = 0x400005d0;
  const ETS_DELAY_US = 0x40000600;
  const UART_TX_ONE_CHAR = 0x40000648;
  const SOFTWARE_RESET = 0x400006d8;
  const ROM_MEMSET = 0x400011e8;
  const ROM_MEMCPY = 0x400011f4;
  const ROM_STRLEN = 0x40001248;
  const SCRATCH = 0x3fc88000 + 0x500;

  it('CALL8 to ets_delay_us burns us·240 cycles and resumes after the windowed return', () => {
    // IO5 goes high, ets_delay_us(10) runs, IO5 goes low — the two
    // cycle-stamped edges must straddle 10 µs at 240 MHz (2400 cycles)
    // plus only a handful of call/stub instructions.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 5, ETS_DELAY_US], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4), // base save area, like every windowed crt0 here
      L32R(2, 0),
      L32R(4, 1),
      S32I(4, 2, 0x24), // enable IO5 (driven low — first drive, no edge)
      S32I(4, 2, 0x08), // IO5 high
      L32R(8, 2), // a8 = ets_delay_us
      MOVI(10, 10), // arg: 10 µs
      CALLXN(2, 8), // call8 into ROM
      S32I(4, 2, 0x0c), // IO5 low — only reached if the RETW worked
      J(BR(-1)),
    ]);
    const c = core(image);
    const io5 = c.step(3_000).events.filter((e) => e.pin === 'IO5');
    expect(io5.map((e) => e.level)).toEqual([1, 0]);
    const span = (io5[1]?.cycle ?? 0) - (io5[0]?.cycle ?? 0);
    expect(span).toBeGreaterThanOrEqual(2_400);
    expect(span).toBeLessThan(2_420); // delay + call overhead only
  });

  it('uart_tx_one_char pushes to the UART0 tx queue and returns 0', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, UART_TX_ONE_CHAR], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32R(8, 1),
      MOVI(10, 0x41), // 'A'
      CALLXN(2, 8),
      S32I(10, 2, 0x00), // tx the return value (0) through the FIFO
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([0x41, 0]);
  });

  it('ets_printf formats register varargs to UART0 and returns the count', () => {
    // "n=%d!\n" packed little-endian into the literal pool: the pool
    // starts at base+4, so the string lives at IRAM_BASE+4.
    const fmt0 = 0x64253d6e; // 'n' '=' '%' 'd'
    const fmt1 = 0x00000a21; // '!' '\n' NUL
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [fmt0, fmt1, ETS_PRINTF, ESP32S3_IRAM_BASE + 4, UART],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        L32R(8, 2), // a8 = ets_printf
        L32R(10, 3), // arg0: the format string
        MOVI(11, 42), // arg1
        CALLXN(2, 8),
        L32R(2, 4),
        S32I(10, 2, 0x00), // tx the return value (6 chars written)
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(120);
    const text = 'n=42!\n';
    expect([...c.drainUart()]).toEqual([...[...text].map((ch) => ch.charCodeAt(0)), text.length]);
  });

  it('memset and memcpy ROM exports mutate DRAM and return dst', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [ROM_MEMSET, ROM_MEMCPY, SCRATCH, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(5, 2), // a5 = SCRATCH
      L32R(8, 0),
      MOV_N(10, 5),
      MOVI(11, 0x5a),
      MOVI(12, 4),
      CALLXN(2, 8), // memset(SCRATCH, 0x5a, 4)
      L32R(8, 1),
      ADDI(10, 5, 8),
      MOV_N(11, 5),
      MOVI(12, 4),
      CALLXN(2, 8), // memcpy(SCRATCH+8, SCRATCH, 4)
      L32R(2, 3),
      L32I(4, 5, 8),
      S32I(4, 2, 0x00), // tx 0x5a — the copy of the fill landed
      SUB(6, 10, 5),
      S32I(6, 2, 0x00), // tx 8 — memcpy returned dst
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(120);
    expect([...c.drainUart()]).toEqual([0x5a, 8]);
  });

  it('strlen ROM export walks memory to the NUL', () => {
    // "Hi!" at IRAM_BASE+4 (the first pool literal).
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [0x00216948, ROM_STRLEN, ESP32S3_IRAM_BASE + 4, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(8, 1),
      L32R(10, 2),
      CALLXN(2, 8),
      L32R(2, 3),
      S32I(10, 2, 0x00), // tx 3
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('software_reset performs a power-on reset and ends the step() call', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SOFTWARE_RESET], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      MOVI(3, 0x21),
      S32I(3, 2, 0x00), // tx '!' (dropped by the reset — power-on clears it)
      L32R(8, 1),
      CALLXN(2, 8), // never returns
      J(BR(-1)),
    ]);
    const c = core(image);
    const res = c.step(10_000);
    expect(res.cycles).toBeLessThan(10_000); // returned early at the reset
    expect(c.inspect().pc).toBe(ESP32S3_IRAM_BASE); // back at the entry point
    expect(c.inspect().cycles).toBe(0);
    expect([...c.drainUart()]).toEqual([]); // peripheral state cleared too
  });

  it('an unmodeled ROM address halts with a diagnostic naming it', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [0x40001000], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(8, 0),
      CALLXN(2, 8),
      J(BR(-1)),
    ]);
    const c = core(image);
    expect(() => c.step(50)).toThrow(/ROM address 0x40001000/);
    expect(() => c.step(50)).toThrow(/ets_delay_us/); // the diagnostic lists what IS modeled
  });
});

describe('Esp32s3Core — RTC/eFuse/SYSTEM (slice 11)', () => {
  // REAL register addresses, pinned independently of the implementation,
  // from esp-idf v5.2 components/soc/esp32s3/include/soc/:
  //   reg_base.h     — DR_REG_EFUSE_BASE 0x60007000, DR_REG_RTCCNTL_BASE
  //                    0x60008000, DR_REG_SYSTEM_BASE 0x600C0000
  //   rtc_cntl_reg.h — OPTIONS0 +0x0, TIME_UPDATE +0xC, TIME_LOW0 +0x10,
  //                    TIME_HIGH0 +0x14, RESET_STATE +0x38
  //   efuse_reg.h    — RD_MAC_SPI_SYS_0 +0x44, _1 +0x48
  //   system_reg.h   — CPU_PER_CONF +0x10, SYSCLK_CONF +0x60
  // Reset causes from esp_rom/include/esp32s3/rom/rtc.h: POWERON_RESET=1,
  // RTC_SW_SYS_RESET=3, RTC_SW_CPU_RESET=12.
  const RTC_OPTIONS0 = 0x60008000;
  const RTC_TIME_UPDATE = 0x6000800c;
  const RTC_RESET_STATE = 0x60008038;
  const EFUSE_MAC0 = 0x60007044;
  const EFUSE_MAC1 = 0x60007048;
  const SYS_CPU_PER_CONF = 0x600c0010;
  const SYS_SYSCLK_CONF = 0x600c0060;
  const SOFTWARE_RESET = 0x400006d8;

  /** Firmware: tx RESET_CAUSE_PROCPU, then if it reads power-on (1) do
   *  `trigger` (a software reset of some flavor); a non-power-on cause
   *  halts. Each test then sees uart [1] from the first boot and the
   *  new cause from the second. */
  const causeRoundTrip = (literals: number[], trigger: XtInstr[]): Uint8Array =>
    assembleXtensa(ESP32S3_IRAM_BASE, [RTC_RESET_STATE, UART, ...literals], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0), // RESET_STATE
      L32I(4, 2, 0),
      MOVI(5, 0x3f),
      AND(4, 4, 5), // RESET_CAUSE_PROCPU [5:0]
      L32R(6, 1),
      S32I(4, 6, 0), // tx the cause
      ADDI(5, 4, -1),
      BNEZ_TO(5, 10 + trigger.length), // not power-on → halt
      ...trigger,
      J_TO(10 + trigger.length), // halt: J self
    ]);

  it('software_reset (slice 10) flips the reset cause from POWERON(1) to RTC_SW_SYS_RESET(3)', () => {
    const image = causeRoundTrip([SOFTWARE_RESET], [
      L32R(8, 2),
      CALLXN(2, 8), // never returns — step() resets
    ]);
    const c = core(image);
    c.step(10_000); // boot 1: tx 1, reset
    expect([...c.drainUart()]).toEqual([]); // reset cleared the tx fifo mid-flight
    c.step(200); // boot 2: tx 3, halt
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('RESET_STATE reports the cause for BOTH CPUs (per-core fields; both POWERON at power-on)', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [RTC_RESET_STATE, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32I(4, 2, 0),
      L32R(6, 1),
      S32I(4, 6, 0), // tx low byte: (appcpu<<6 | procpu) & 0xff = 0x41 at power-on
      J_TO(6),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([0x41]); // 1<<6 | 1
  });

  it('writing RTC_CNTL_SW_SYS_RST (OPTIONS0 bit 31) resets with cause 3', () => {
    const image = causeRoundTrip([RTC_OPTIONS0], [
      L32R(8, 2),
      MOVI(9, 1),
      SLLI(9, 9, 31),
      S32I(9, 8, 0), // OPTIONS0 ← SW_SYS_RST
    ]);
    const c = core(image);
    c.step(10_000);
    c.step(200);
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('writing RTC_CNTL_SW_PROCPU_RST (OPTIONS0 bit 5) resets with cause RTC_SW_CPU_RESET(12)', () => {
    const image = causeRoundTrip([RTC_OPTIONS0], [
      L32R(8, 2),
      MOVI(9, 1 << 5),
      S32I(9, 8, 0),
    ]);
    const c = core(image);
    c.step(10_000);
    c.step(200);
    expect([...c.drainUart()]).toEqual([12]);
  });

  it('the RTC slow-clock counter ticks at 136 kHz and latches on TIME_UPDATE', () => {
    // ets_delay_us(1000) jumps CCOUNT by 240_000 cycles; the 48-bit RTC
    // main timer then reads 1000 µs × 136 kHz = 136 ticks.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [RTC_TIME_UPDATE, UART, 0x40000600], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0), // TIME_UPDATE
      L32I(4, 2, 4), // TIME_LOW0 (no update yet — must read the 0 latch)
      L32R(6, 1),
      S32I(4, 6, 0), // tx 0
      L32R(8, 2),
      MOVI(10, 1000),
      CALLXN(2, 8), // ets_delay_us(1000)
      MOVI(9, 1),
      SLLI(9, 9, 31),
      S32I(9, 2, 0), // TIME_UPDATE ← bit 31: latch now
      L32I(4, 2, 4), // TIME_LOW0
      S32I(4, 6, 0), // tx 136
      L32I(4, 2, 8), // TIME_HIGH0
      S32I(4, 6, 0), // tx 0
      J_TO(16),
    ]);
    const c = core(image);
    c.step(250_000);
    expect([...c.drainUart()]).toEqual([0, 136, 0]);
  });

  it('eFuse MAC registers serve the documented synthetic MAC 7A:C0:DE:00:53:33', () => {
    // efuse_hal_get_mac order: mac[0]=mac_1>>8, mac[1]=mac_1, mac[2..5]=mac_0
    // big-endian — so mac_0 = 0xDE005333, mac_1 = 0x00007AC0.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [EFUSE_MAC0, EFUSE_MAC1, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32I(4, 2, 0), // MAC_0
      L32R(6, 2),
      S32I(4, 6, 0), // tx 0x33 (tx masks to the low byte)
      SRAI(5, 4, 8),
      S32I(5, 6, 0), // tx 0x53
      SRAI(5, 4, 16),
      S32I(5, 6, 0), // tx 0x00
      SRAI(5, 4, 24),
      S32I(5, 6, 0), // tx 0xde
      L32R(2, 1),
      L32I(4, 2, 0), // MAC_1
      S32I(4, 6, 0), // tx 0xc0
      SRAI(5, 4, 8),
      S32I(5, 6, 0), // tx 0x7a
      J_TO(17),
    ]);
    const c = core(image);
    c.step(120);
    expect([...c.drainUart()]).toEqual([0x33, 0x53, 0x00, 0xde, 0xc0, 0x7a]);
  });

  it('eFuse wafer-version words (RD_MAC_SPI_SYS_2..5) read 0 — chip revision v0.0', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [0x6000704c, 0x60007058, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32I(4, 2, 0),
      L32R(6, 2),
      S32I(4, 6, 0),
      L32R(2, 1),
      L32I(4, 2, 0),
      S32I(4, 6, 0),
      J_TO(9),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([0, 0]);
  });

  it('SYSTEM clock-config registers describe the modeled post-bootloader 240 MHz PLL state', () => {
    // CPU_PER_CONF: PLL_FREQ_SEL=1 (480 MHz PLL), CPUPERIOD_SEL=2 (240 MHz) → 0x6.
    // SYSCLK_CONF: CLK_XTAL_FREQ=40 [18:12], SOC_CLK_SEL=1 (PLL) [11:10],
    // PRE_DIV_CNT=1 [9:0] → 0x28401.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [SYS_CPU_PER_CONF, SYS_SYSCLK_CONF, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32I(4, 2, 0),
      L32R(6, 2),
      S32I(4, 6, 0), // tx 0x06
      L32R(2, 1),
      L32I(4, 2, 0),
      S32I(4, 6, 0), // tx 0x01 (PRE_DIV_CNT)
      SRAI(5, 4, 10),
      S32I(5, 6, 0), // tx 0xa1 = CLK_XTAL_FREQ<<2 | SOC_CLK_SEL = 40<<2|1
      J_TO(11),
    ]);
    const c = core(image);
    c.step(80);
    expect([...c.drainUart()]).toEqual([0x06, 0x01, 0xa1]);
  });

  it('a read of an unmodeled RTC_CNTL register halts with a diagnostic naming it', () => {
    // 0x60008090 is RTC_CNTL_WDTCONFIG0_REG territory — reading 0 there
    // would silently claim "watchdog off", so the core refuses instead.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [0x60008090], [
      L32R(2, 0),
      L32I(4, 2, 0),
      J_TO(2),
    ]);
    const c = core(image);
    expect(() => c.step(50)).toThrow(/0x60008090/);
    expect(() => c.step(50)).toThrow(/RESET_STATE/); // lists what IS modeled
  });

  it('eFuse and unmodeled SYSTEM reads refuse too; eFuse writes always refuse', () => {
    const rd = (addr: number): Esp32s3Core =>
      core(assembleXtensa(ESP32S3_IRAM_BASE, [addr], [L32R(2, 0), L32I(4, 2, 0), J_TO(2)]));
    expect(() => rd(0x60007000).step(50)).toThrow(/0x60007000/); // EFUSE_PGM_DATA0
    expect(() => rd(0x600c0018).step(50)).toThrow(/0x600c0018/); // SYSTEM_PERIP_CLK_EN0
    const wr = core(assembleXtensa(ESP32S3_IRAM_BASE, [EFUSE_MAC0], [L32R(2, 0), S32I(2, 2, 0), J_TO(2)]));
    expect(() => wr.step(50)).toThrow(/read-only/);
  });
});

describe('Esp32s3Core — second core (slice 12)', () => {
  // REAL register addresses/bits, pinned independently of the
  // implementation, from esp-idf v5.2:
  //   system_reg.h    — SYSTEM_CORE_1_CONTROL_0_REG = SYSTEM_BASE+0x0
  //                     (RUNSTALL bit 0, CLKGATE_EN bit 1, RESETING
  //                     bit 2 — default 1), CONTROL_1 +0x4 (MESSAGE)
  //   rtc_cntl_reg.h  — OPTIONS0 SW_STALL_APPCPU_C0 [1:0],
  //                     SW_CPU_STALL_REG +0xBC, APPCPU_C1 [25:20]
  //   esp32s3.rom.ld  — ets_set_appcpu_boot_addr = 0x40000720
  //   cpu_start.c     — start_other_core: unstall → CLKGATE_EN set,
  //                     RUNSTALL clear, RESETING pulse → boot addr.
  const SYS = 0x600c0000;
  const RTC = 0x60008000;
  const SET_BOOT = 0x40000720;
  const CORE1_ENTRY = ESP32S3_IRAM_BASE + 0x400;

  it('core 1 is held in reset at power-on — boot address alone starts nothing', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [SET_BOOT, CORE1_ENTRY, GPIO, 1 << 7], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(8, 0),
      L32R(10, 1),
      CALLXN(2, 8), // ets_set_appcpu_boot_addr(CORE1_ENTRY) — but RESETING is still 1
      J_TO(5),
      PAD_TO(0x400),
      // core 1 (never released): would toggle IO7 forever
      L32R(2, 2),
      L32R(3, 3),
      S32I(3, 2, 0x24), // ENABLE_W1TS
      S32I(3, 2, 0x08),
      S32I(3, 2, 0x0c),
      J_TO(10),
    ]);
    const c = core(image);
    const { events } = c.step(2_000);
    expect(events.filter((e) => e.pin === 'IO7')).toEqual([]);
  });

  it("IDF's release sequence (unstall → clkgate/runstall/reset pulse → boot addr) starts core 1", () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTC, SYS, SET_BOOT, CORE1_ENTRY, GPIO, 1 << 7, UART],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        // esp_cpu_unstall(1): clear the split 0x86 stall code.
        L32R(4, 0),
        MOVI(5, 0),
        S32I(5, 4, 0), // OPTIONS0 ← 0 (SW_STALL_APPCPU_C0 [1:0] clear)
        S32I(5, 4, 0xbc), // SW_CPU_STALL ← 0 (APPCPU_C1 [25:20] clear)
        // start_other_core's SYSTEM dance:
        L32R(4, 1),
        L32I(6, 4, 0), // read CONTROL_0 — RESETING (bit 2) set at power-on
        L32R(9, 6),
        S32I(6, 9, 0), // tx 0x04
        MOVI(7, 6),
        S32I(7, 4, 0), // CLKGATE_EN | RESETING
        MOVI(7, 2),
        S32I(7, 4, 0), // clear RESETING — core 1 released, parked in ROM
        L32R(8, 2),
        L32R(10, 3),
        CALLXN(2, 8), // ets_set_appcpu_boot_addr(CORE1_ENTRY) → core 1 starts
        J_TO(17),
        PAD_TO(0x400),
        // core 1: toggle IO7 forever (core 0 never touches IO7)
        L32R(2, 4),
        L32R(3, 5),
        S32I(3, 2, 0x24),
        S32I(3, 2, 0x08),
        S32I(3, 2, 0x0c),
        J_TO(22),
      ],
    );
    const c = core(image);
    const { events } = c.step(2_000);
    expect([...c.drainUart()]).toEqual([0x04]); // power-on CONTROL_0 = RESETING
    const io7 = events.filter((e) => e.pin === 'IO7');
    expect(io7.length).toBeGreaterThan(3);
    expect(io7[0]?.level).toBe(1); // W1TS first, strict alternation after
    for (let i = 1; i < io7.length; i++) expect(io7[i]?.level).toBe(1 - (io7[i - 1]?.level ?? 0));
  });

  it('both cores run interleaved — two GPIOs toggle with overlapping cycle stamps', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [SYS, SET_BOOT, CORE1_ENTRY, GPIO, 1 << 5, 1 << 7],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        L32R(4, 0),
        MOVI(7, 6),
        S32I(7, 4, 0),
        MOVI(7, 2),
        S32I(7, 4, 0),
        L32R(8, 1),
        L32R(10, 2),
        CALLXN(2, 8),
        // core 0: toggle IO5 forever
        L32R(2, 3),
        L32R(3, 4),
        S32I(3, 2, 0x24),
        S32I(3, 2, 0x08),
        S32I(3, 2, 0x0c),
        J_TO(13),
        PAD_TO(0x400),
        // core 1: toggle IO7 forever
        L32R(2, 3),
        L32R(3, 5),
        S32I(3, 2, 0x24),
        S32I(3, 2, 0x08),
        S32I(3, 2, 0x0c),
        J_TO(20),
      ],
    );
    const c = core(image);
    const { events } = c.step(2_000);
    const io5 = events.filter((e) => e.pin === 'IO5');
    const io7 = events.filter((e) => e.pin === 'IO7');
    expect(io5.length).toBeGreaterThan(3);
    expect(io7.length).toBeGreaterThan(3);
    // Interleaved, not sequential: each stream starts before the other ends.
    expect(io7[0]!.cycle).toBeLessThan(io5[io5.length - 1]!.cycle);
    expect(io5[0]!.cycle).toBeLessThan(io7[io7.length - 1]!.cycle);
  });

  it("per-core CCOMPARE0 interrupts don't cross-fire (separate VECBASE/INTENABLE/CCOUNT)", () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [SYS, SET_BOOT, CORE1_ENTRY, GPIO, 1 << 5, 1 << 7, ESP32S3_IRAM_BASE, CORE1_ENTRY],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        L32R(4, 0),
        MOVI(7, 6),
        S32I(7, 4, 0),
        MOVI(7, 2),
        S32I(7, 4, 0),
        L32R(8, 1),
        L32R(10, 2),
        CALLXN(2, 8),
        // core 0: arm its core timer ~256 cycles out; ISR raises IO5.
        L32R(2, 3),
        L32R(3, 4),
        S32I(3, 2, 0x24), // enable IO5 (drives 0)
        L32R(5, 6),
        WSR(5, SR.VECBASE),
        MOVI(6, 64),
        WSR(6, SR.INTENABLE),
        RSR(7, SR.CCOUNT),
        ADDMI(7, 7, 256),
        WSR(7, SR.CCOMPARE0),
        RSIL(8, 0),
        J_TO(21),
        PAD_TO(0x340), // core 0's level-1 vector
        L32R(2, 3),
        L32R(3, 4),
        S32I(3, 2, 0x08), // IO5 ← 1, exactly once
        RSR(4, SR.CCOMPARE0),
        ADDMI(4, 4, 32512), // re-arm far past the test horizon
        WSR(4, SR.CCOMPARE0),
        RFE(),
        PAD_TO(0x400),
        // core 1: same shape, ~512 cycles out on ITS OWN CCOUNT; ISR raises IO7.
        L32R(2, 3),
        L32R(3, 5),
        S32I(3, 2, 0x24),
        L32R(5, 7),
        WSR(5, SR.VECBASE),
        MOVI(6, 64),
        WSR(6, SR.INTENABLE),
        RSR(7, SR.CCOUNT),
        ADDMI(7, 7, 512),
        WSR(7, SR.CCOMPARE0),
        RSIL(8, 0),
        J_TO(41),
        PAD_TO(0x740), // core 1's vector: VECBASE(0x400) + 0x340
        L32R(2, 3),
        L32R(3, 5),
        S32I(3, 2, 0x08),
        RSR(4, SR.CCOMPARE0),
        ADDMI(4, 4, 32512),
        WSR(4, SR.CCOMPARE0),
        RFE(),
      ],
    );
    const c = core(image);
    const { events } = c.step(1_500);
    const io5 = events.filter((e) => e.pin === 'IO5');
    const io7 = events.filter((e) => e.pin === 'IO7');
    // Each timer fires exactly once, on its own core, on its own schedule.
    expect(io5.map((e) => e.level)).toEqual([1]);
    expect(io7.map((e) => e.level)).toEqual([1]);
    expect(io7[0]!.cycle - io5[0]!.cycle).toBeGreaterThan(150);
  });

  it('SW_APPCPU_RST sets the APPCPU reset cause (12) while PROCPU keeps power-on (1)', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [SYS, SET_BOOT, CORE1_ENTRY, RTC, UART],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        L32R(4, 0),
        MOVI(7, 6),
        S32I(7, 4, 0),
        MOVI(7, 2),
        S32I(7, 4, 0),
        L32R(8, 1),
        L32R(10, 2),
        CALLXN(2, 8), // core 1 running
        L32R(4, 3),
        MOVI(5, 1 << 4),
        S32I(5, 4, 0), // OPTIONS0 ← SW_APPCPU_RST: resets core 1 only
        L32I(6, 4, 0x38), // RESET_STATE
        L32R(9, 4),
        SRLI(7, 6, 6),
        MOVI(8, 0x3f),
        AND(7, 7, 8),
        S32I(7, 9, 0), // tx RESET_CAUSE_APPCPU [11:6] = 12
        MOVI(8, 0x3f),
        AND(6, 6, 8),
        S32I(6, 9, 0), // tx RESET_CAUSE_PROCPU [5:0] = 1
        J_TO(22),
        PAD_TO(0x400),
        J_TO(24), // core 1: park
      ],
    );
    const c = core(image);
    c.step(2_000);
    expect([...c.drainUart()]).toEqual([12, 1]);
  });
});

describe('Esp32s3Core — timers + watchdogs (slice 13)', () => {
  // REAL register addresses, pinned independently of the implementation,
  // from esp-idf v5.2 components/soc/esp32s3/include/soc/:
  //   reg_base.h        — DR_REG_TIMERGROUP0_BASE 0x6001F000,
  //                       DR_REG_TIMERGROUP1_BASE 0x60020000
  //   timer_group_reg.h — T1CONFIG +0x24..T1LOAD +0x44 (T0's layout +0x24);
  //                       WDTCONFIG0 +0x48, WDTCONFIG1 +0x4C (CLK_PRESCALE
  //                       [31:16]), WDTCONFIG2..5 +0x50..0x5C (stage0..3
  //                       timeouts), WDTFEED +0x60 (any write feeds),
  //                       WDTWPROTECT +0x64, TIMG_WDT_WKEY_VALUE 0x50D83AA1;
  //                       INT_* bits: T0=0, T1=1, WDT=2
  //   rtc_cntl_reg.h    — RTC_CNTL_WDTCONFIG0 +0x98 (EN 31, STG0 [30:28]),
  //                       WDTCONFIG1..4 +0x9C..0xA8 (stage0..3 timeouts in
  //                       RTC-slow ticks), WDTFEED +0xAC, WDTWPROTECT +0xB0
  //                       (same 0x50D83AA1 key — hal/esp32s3 rwdt_ll.h)
  //   interrupt_core0_reg.h — TG1_T1_INT_MAP +0x0D8
  // Stage actions (hal/wdt_types.h): 0 off, 1 interrupt, 2 reset CPU,
  // 3 reset system, 4 reset RTC (RWDT only). Reset causes
  // (esp_rom/include/esp32s3/rom/rtc.h): TG0WDT_SYS_RESET=7,
  // TG1WDT_SYS_RESET=8, RTCWDT_SYS_RESET=9, RTCWDT_RTC_RESET=16.
  const SCRATCH = 0x3fc88000 + 0xa00;
  const TIMG0 = 0x6001f000;
  const TIMG1 = 0x60020000;
  const INTMTX = 0x600c2000;
  const RTC_RESET_STATE = 0x60008038;
  const RTCCNTL = 0x60008000;
  const WDT_KEY = 0x50d83aa1;
  // T1CONFIG: EN | INCREASE | divider 2 | AUTORELOAD off | ALARM_EN.
  const T1_CFG_ONESHOT = (0x80000000 | 0x40000000 | (2 << 13) | (1 << 10)) >>> 0;
  // MWDT CONFIG0: EN (31) | STG0 = reset-system (3 << 29).
  const MWDT_EN_STG0_SYS = (0x80000000 | (3 << 29)) >>> 0;
  // RWDT CONFIG0: EN (31) | STG0 = reset-system (3 << 28).
  const RWDT_EN_STG0_SYS = (0x80000000 | (3 << 28)) >>> 0;

  /** Same shape as the slice-11 helper: tx RESET_CAUSE_PROCPU, then on
   *  power-on (1) run `trigger` and fall into a self-loop halt; a
   *  non-power-on cause halts straight away. */
  const causeRoundTrip = (literals: number[], trigger: XtInstr[]): Uint8Array =>
    assembleXtensa(ESP32S3_IRAM_BASE, [RTC_RESET_STATE, UART, ...literals], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0), // RESET_STATE
      L32I(4, 2, 0),
      MOVI(5, 0x3f),
      AND(4, 4, 5), // RESET_CAUSE_PROCPU [5:0]
      L32R(6, 1),
      S32I(4, 6, 0), // tx the cause
      ADDI(5, 4, -1),
      BNEZ_TO(5, 10 + trigger.length), // not power-on → halt
      ...trigger,
      J_TO(10 + trigger.length), // halt: J self
    ]);

  it('TIMG1 T1 fires through the matrix on its own line, independent of TIMG0 T0', () => {
    // The slice-8 one-shot dance, transplanted to group 1 / timer 1:
    // T1 register block at +0x24, INT bit 1, TG1_T1 map at +0x0D8.
    // TIMG0's INT_RAW must stay 0 throughout — nothing leaks across.
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, SCRATCH, ESP32S3_IRAM_BASE, TIMG1, INTMTX, T1_CFG_ONESHOT, TIMG0],
      [
        L32R(2, 0), // a2 = UART
        L32R(3, 1), // a3 = SCRATCH
        MOVI(4, 0),
        S32I(4, 3, 0), // counter = 0
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(6, 3), // a6 = TIMG1
        MOVI(7, 0),
        S32I(7, 6, 0x3c), // T1LOADLO = 0
        S32I(7, 6, 0x40), // T1LOADHI = 0
        S32I(7, 6, 0x44), // T1LOAD — counter ← 0
        MOVI(7, 30),
        S32I(7, 6, 0x34), // T1ALARMLO = 30 ticks
        MOVI(7, 0),
        S32I(7, 6, 0x38), // T1ALARMHI = 0
        MOVI(7, 2),
        S32I(7, 6, 0x70), // INT_ENA = T1 (bit 1)
        L32R(8, 4),
        MOVI(7, 2),
        S32I(7, 8, 0xd8), // TG1_T1 source → CPU line 2
        MOVI(7, 4),
        WSR(7, SR.INTENABLE), // 1 << 2
        L32R(7, 5),
        S32I(7, 6, 0x24), // T1CONFIG — armed, one-shot
        RSIL(9, 0),
        MOVI(10, 600),
        ADDI(10, 10, -1),
        BNEZ(10, BR(-2)), // burn far past the alarm
        L32R(11, 6), // a11 = TIMG0
        L32I(12, 11, 0x74),
        S32I(12, 2, 0x00), // tx TIMG0 INT_RAW — must be 0
        L32I(4, 3, 0),
        S32I(4, 2, 0x00), // tx the count — exactly 1
        J(BR(-1)),
        PAD_TO(0x340),
        // handler: counter++, INT_CLR(T1) — no re-arm (one-shot).
        WSR(2, SR.EXCSAVE1),
        L32R(2, 1),
        S32I(3, 2, 8),
        S32I(4, 2, 12),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 3), // a3 = TIMG1
        MOVI(4, 2),
        S32I(4, 3, 0x7c), // INT_CLR = T1
        L32I(4, 2, 12),
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(2_500);
    expect([...c.drainUart()]).toEqual([0, 1]);
  });

  it('MWDT config writes are ignored while write-protected; the 0x50D83AA1 key unlocks', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [TIMG0, WDT_KEY, UART], [
      L32R(2, 0), // a2 = TIMG0
      L32R(3, 1), // a3 = key
      L32R(4, 2), // a4 = UART
      MOVI(5, 77),
      S32I(5, 2, 0x50), // WDTCONFIG2 ← 77 (unprotected at reset, like hardware)
      MOVI(6, 0),
      S32I(6, 2, 0x64), // WDTWPROTECT ← 0: protect
      MOVI(5, 50),
      S32I(5, 2, 0x50), // ignored — protected
      L32I(7, 2, 0x50),
      S32I(7, 4, 0), // tx 77
      S32I(3, 2, 0x64), // WDTWPROTECT ← key: unlock
      MOVI(5, 50),
      S32I(5, 2, 0x50), // sticks now
      L32I(7, 2, 0x50),
      S32I(7, 4, 0), // tx 50
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(200);
    expect([...c.drainUart()]).toEqual([77, 50]);
  });

  it('an enabled, unfed MWDT0 stage-0 system reset reboots with cause TG0WDT_SYS_RESET (7)', () => {
    const image = causeRoundTrip([TIMG0, WDT_KEY, MWDT_EN_STG0_SYS], [
      L32R(8, 2), // a8 = TIMG0
      L32R(9, 3), // a9 = key
      S32I(9, 8, 0x64), // unlock (reset state is unlocked; explicit like wdt_hal)
      MOVI(10, 10),
      S32I(10, 8, 0x50), // WDTCONFIG2: stage0 = 10 ticks
      MOVI(10, 1),
      SLLI(10, 10, 16),
      S32I(10, 8, 0x4c), // WDTCONFIG1: prescale 1 (80 MHz MWDT clock)
      L32R(10, 4),
      S32I(10, 8, 0x48), // WDTCONFIG0: EN | STG0=reset-system — then spin
    ]);
    const c = core(image);
    c.step(10_000); // boot 1: tx 1, then the WDT bites mid-spin
    c.step(500); // boot 2: tx the cause, halt
    expect([...c.drainUart()]).toEqual([7]);
  });

  it('feeding WDTFEED inside the loop holds the reset off', () => {
    const image = causeRoundTrip([TIMG0, WDT_KEY, MWDT_EN_STG0_SYS], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0x64),
      MOVI(10, 10),
      S32I(10, 8, 0x50), // stage0 = 10 ticks (30 CPU cycles)
      MOVI(10, 1),
      SLLI(10, 10, 16),
      S32I(10, 8, 0x4c),
      L32R(10, 4),
      S32I(10, 8, 0x48), // armed
      MOVI(10, 200), // 200 × (feed every ~3 cycles) ≫ 10-tick timeout
      S32I(9, 8, 0x60), // WDTFEED — any write feeds
      ADDI(10, 10, -1),
      BNEZ(10, BR(-3)),
      MOVI(10, 0),
      S32I(10, 8, 0x48), // cleanup: disarm before the unfed halt spin
      L32R(11, 1), // UART
      MOVI(12, 42),
      S32I(12, 11, 0), // tx 42 — still on boot 1
    ]);
    const c = core(image);
    c.step(10_000);
    expect([...c.drainUart()]).toEqual([1, 42]);
  });

  it("IDF's disable sequence (key, WDTCONFIG0=0, re-protect) silences an armed MWDT for good", () => {
    const image = causeRoundTrip([TIMG0, WDT_KEY, MWDT_EN_STG0_SYS], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0x64),
      MOVI(10, 10),
      S32I(10, 8, 0x50),
      MOVI(10, 1),
      SLLI(10, 10, 16),
      S32I(10, 8, 0x4c),
      L32R(10, 4),
      S32I(10, 8, 0x48), // armed — and now the wdt_hal disable dance:
      MOVI(10, 0),
      S32I(10, 8, 0x48), // WDTCONFIG0 ← 0 (still unlocked)
      S32I(10, 8, 0x64), // WDTWPROTECT ← 0: re-protect
      MOVI(10, 200),
      ADDI(10, 10, -1),
      BNEZ(10, BR(-2)), // burn far past the dead timeout — no feeds
      L32R(11, 1),
      MOVI(12, 99),
      S32I(12, 11, 0), // tx 99 — never rebooted
    ]);
    const c = core(image);
    c.step(10_000);
    expect([...c.drainUart()]).toEqual([1, 99]);
  });

  it('an unfed RWDT reboots with its own cause, RTCWDT_SYS_RESET (9)', () => {
    const image = causeRoundTrip([RTCCNTL, WDT_KEY, RWDT_EN_STG0_SYS], [
      L32R(8, 2), // a8 = RTC_CNTL
      L32R(9, 3),
      S32I(9, 8, 0xb0), // RTC_CNTL_WDTWPROTECT ← key
      MOVI(10, 2),
      S32I(10, 8, 0x9c), // WDTCONFIG1: stage0 = 2 RTC-slow ticks (~3530 cycles)
      L32R(10, 4),
      S32I(10, 8, 0x98), // WDTCONFIG0: EN | STG0=reset-system — then spin
    ]);
    const c = core(image);
    c.step(20_000); // boot 1: tx 1, RWDT bites
    c.step(500); // boot 2: tx the cause
    expect([...c.drainUart()]).toEqual([9]);
  });
});

describe('Esp32s3Core — ADC continuous GDMA frames (slice 16)', () => {
  const GDMA = 0x6003f000;
  const APB_SARADC = 0x60040000;
  const DESC = ESP32S3_DRAM_BASE + 0x1000;
  const BUF = ESP32S3_DRAM_BASE + 0x1040;
  const DESC_LINK_START = (DESC & 0x000f_ffff) | (1 << 22) | (1 << 20);
  const DESC_8_BYTES_DMA = 0x80000008;
  const ADC_DAC_PERI = 8;
  const ADC1_CH2_PATTERN = (2 << 2) << 18;

  it('writes ADC digital-controller results into a GDMA RX descriptor buffer', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [DESC, BUF, DESC_8_BYTES_DMA, GDMA, DESC_LINK_START, APB_SARADC, ADC1_CH2_PATTERN, UART],
      [
        L32R(2, 0), // a2 = descriptor
        L32R(3, 1), // a3 = buffer
        L32R(4, 2), // owner=DMA, size=8 bytes
        S32I(4, 2, 0),
        S32I(3, 2, 4),
        MOVI(5, 0),
        S32I(5, 2, 8), // next = NULL

        L32R(6, 3), // a6 = GDMA base
        MOVI(7, ADC_DAC_PERI),
        S32I(7, 6, 0x48), // IN_PERI_SEL_CH0 = ADC_DAC
        L32R(7, 4),
        S32I(7, 6, 0x20), // IN_LINK_CH0 = desc | START

        L32R(8, 5), // a8 = APB_SARADC
        L32R(9, 6),
        S32I(9, 8, 0x18), // SAR1 pattern table: ADC1 channel 2
        MOVI(10, 2),
        S32I(10, 8, 0x00), // START edge: sample 1
        MOVI(10, 0),
        S32I(10, 8, 0x00),
        MOVI(10, 2),
        S32I(10, 8, 0x00), // START edge: sample 2, descriptor complete

        L32R(12, 7), // UART
        L32I(11, 3, 0),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // sample 1 high byte: 0x48 = ch2 + 2048 raw
        L32I(11, 3, 4),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // sample 2 high byte
        L32I(11, 2, 0),
        SRLI(11, 11, 12),
        S32I(11, 12, 0), // descriptor length = 8
        L32I(11, 6, 0x08),
        S32I(11, 12, 0), // GDMA INT_RAW = DONE|SUC_EOF
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 2 ? 1.65 : 0));
    c.step(400);

    expect([...c.drainUart()]).toEqual([0x48, 0x48, 8, 3]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([2, 2]);
  });
});
