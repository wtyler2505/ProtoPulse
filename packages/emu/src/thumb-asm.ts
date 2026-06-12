/**
 * Tiny Thumb hand-assembler — test infrastructure, exported on purpose
 * (the Cortex-M0+ sibling of asm.ts).
 *
 * Just enough Thumb-16 opcodes to write the firmware the RP2040 tests
 * need (SIO pokes, busy loops, UART/ADC register access) without
 * shipping a compiled binary in the repo. NOT a general assembler: no
 * labels — branch offsets are given in HALFWORDS relative to PC+4
 * (i.e. relative to the instruction after next), exactly as encoded.
 *
 * Encodings transcribed from the ARMv6-M Architecture Reference
 * Manual (DDI 0419); each builder's comment shows the bit layout.
 */

function assertRange(value: number, min: number, max: number, what: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${what} out of range: ${String(value)} (expected ${String(min)}..${String(max)})`);
  }
}

/** MOVS Rd,#imm8 — 0010 0ddd iiii iiii. */
export function MOVS(d: number, imm8: number): number {
  assertRange(d, 0, 7, 'MOVS register');
  assertRange(imm8, 0, 0xff, 'MOVS immediate');
  return 0x2000 | (d << 8) | imm8;
}

/** LSLS Rd,Rm,#imm5 — 0000 0iii iimm mddd. */
export function LSLS(d: number, m: number, imm5: number): number {
  assertRange(d, 0, 7, 'LSLS Rd');
  assertRange(m, 0, 7, 'LSLS Rm');
  assertRange(imm5, 0, 31, 'LSLS shift');
  return 0x0000 | (imm5 << 6) | (m << 3) | d;
}

/** ADDS Rd,Rn,Rm (register, T1) — 0001 100m mmnn nddd. */
export function ADDS(d: number, n: number, m: number): number {
  assertRange(d, 0, 7, 'ADDS Rd');
  assertRange(n, 0, 7, 'ADDS Rn');
  assertRange(m, 0, 7, 'ADDS Rm');
  return 0x1800 | (m << 6) | (n << 3) | d;
}

/** SUBS Rd,#imm8 (T2) — 0011 1ddd iiii iiii. */
export function SUBS_IMM(d: number, imm8: number): number {
  assertRange(d, 0, 7, 'SUBS register');
  assertRange(imm8, 0, 0xff, 'SUBS immediate');
  return 0x3800 | (d << 8) | imm8;
}

/** STR Rt,[Rn,#imm] (imm = multiple of 4, ≤124) — 0110 0iii iinn nttt. */
export function STR(t: number, n: number, imm: number): number {
  assertRange(t, 0, 7, 'STR Rt');
  assertRange(n, 0, 7, 'STR Rn');
  assertRange(imm, 0, 124, 'STR offset');
  if (imm % 4 !== 0) throw new Error('STR offset must be word-aligned');
  return 0x6000 | ((imm >> 2) << 6) | (n << 3) | t;
}

/** LDR Rt,[Rn,#imm] (imm = multiple of 4, ≤124) — 0110 1iii iinn nttt. */
export function LDR(t: number, n: number, imm: number): number {
  assertRange(t, 0, 7, 'LDR Rt');
  assertRange(n, 0, 7, 'LDR Rn');
  assertRange(imm, 0, 124, 'LDR offset');
  if (imm % 4 !== 0) throw new Error('LDR offset must be word-aligned');
  return 0x6800 | ((imm >> 2) << 6) | (n << 3) | t;
}

/** ANDS Rdn,Rm — 0100 0000 00mm mddd. */
export function ANDS(dn: number, m: number): number {
  assertRange(dn, 0, 7, 'ANDS Rdn');
  assertRange(m, 0, 7, 'ANDS Rm');
  return 0x4000 | (m << 3) | dn;
}

/** TST Rn,Rm — 0100 0010 00mm mnnn. */
export function TST(n: number, m: number): number {
  assertRange(n, 0, 7, 'TST Rn');
  assertRange(m, 0, 7, 'TST Rm');
  return 0x4200 | (m << 3) | n;
}

/** CMP Rn,#imm8 — 0010 1nnn iiii iiii. */
export function CMP_IMM(n: number, imm8: number): number {
  assertRange(n, 0, 7, 'CMP Rn');
  assertRange(imm8, 0, 0xff, 'CMP immediate');
  return 0x2800 | (n << 8) | imm8;
}

export const COND_EQ = 0;
export const COND_NE = 1;

/** B<c> label (T1) — 1101 cccc iiii iiii; offset in halfwords from PC+4. */
export function BCOND(cond: number, offsetHalfwords: number): number {
  assertRange(cond, 0, 13, 'branch condition');
  assertRange(offsetHalfwords, -128, 127, 'conditional branch offset');
  return 0xd000 | (cond << 8) | (offsetHalfwords & 0xff);
}

/** B label (T2) — 1110 0iii iiii iiii; offset in halfwords from PC+4. */
export function B(offsetHalfwords: number): number {
  assertRange(offsetHalfwords, -1024, 1023, 'branch offset');
  return 0xe000 | (offsetHalfwords & 0x7ff);
}

/** NOP — 1011 1111 0000 0000. */
export function THUMB_NOP(): number {
  return 0xbf00;
}

/** Halfword opcodes → little-endian bytes, as flashed. */
export function assembleThumb(halfwords: number[]): Uint8Array {
  const out = new Uint8Array(halfwords.length * 2);
  halfwords.forEach((hw, i) => {
    out[i * 2] = hw & 0xff;
    out[i * 2 + 1] = (hw >> 8) & 0xff;
  });
  return out;
}

/** Emit MOVS+LSLS+ADDS sequences that build an arbitrary 32-bit
 *  constant in Rd, clobbering Rscratch. Width varies — compose
 *  programs with concat, not fixed offsets, around this. */
export function loadConst(d: number, scratch: number, value: number): number[] {
  assertRange(value, 0, 0xffffffff, 'constant');
  if (d === scratch) throw new Error('loadConst needs distinct registers');
  // Build from the top byte down: Rd = ((b3·2^8 + b2)·2^8 + b1)·2^8 + b0
  const bytes = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  const out: number[] = [MOVS(d, bytes[0] ?? 0)];
  for (const b of bytes.slice(1)) {
    out.push(LSLS(d, d, 8));
    if (b !== 0) {
      out.push(MOVS(scratch, b), ADDS(d, d, scratch));
    }
  }
  return out;
}
