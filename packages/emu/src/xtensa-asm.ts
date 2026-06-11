/**
 * Hand-assembler for the Xtensa LX7 subset the ESP32-S3 core executes —
 * the asm.ts / thumb-asm.ts sibling. 24-bit core instructions plus the
 * 16-bit code-density forms (narrow builders carry their width through
 * layout), call0 ABI (no register windows). Encodings verified against
 * the Espressif ISA overview, the full Cadence ISA RM, and the
 * ida-xtensa2 disassembler tables, with known-good byte fixtures
 * pinned in the tests — see
 * inbox/2026-06-11-esp32s3-emulator-core-verification.md.
 *
 * Control flow comes in two styles: raw-immediate builders (BEQ/J/…
 * with BR(), valid ONLY in uniform 24-bit code) and index-based
 * *_TO placeholders the assembler resolves from the real mixed-width
 * layout — prefer those; hand-counted offsets are how bugs happen.
 *
 * Field layout (little-endian 24-bit word): op0=bits[3:0], t=[7:4],
 * s=[11:8], r=[15:12], op1=[19:16], op2=[23:20].
 */

function reg(v: number, name: string): number {
  if (!Number.isInteger(v) || v < 0 || v > 15) {
    throw new Error(`${name} must be a0..a15 (got ${String(v)})`);
  }
  return v;
}

function range(v: number, lo: number, hi: number, name: string): number {
  if (!Number.isInteger(v) || v < lo || v > hi) {
    throw new Error(`${name} out of range ${String(lo)}..${String(hi)} (got ${String(v)})`);
  }
  return v;
}

const rri8 = (op: number, r: number, s: number, t: number, imm8: number): number =>
  op | (t << 4) | (s << 8) | (r << 12) | ((imm8 & 0xff) << 16);

const rrr = (op: number, r: number, s: number, t: number): number =>
  op | (t << 4) | (s << 8) | (r << 12);

// ── Constants / moves ────────────────────────────────────────────────

/** MOVI at, imm — AR[t] ← sext(imm12); imm split s||imm8. */
export function MOVI(t: number, imm: number): number {
  reg(t, 'MOVI target');
  range(imm, -2048, 2047, 'MOVI immediate');
  const u = imm & 0xfff;
  return 0x00a002 | (reg(t, 't') << 4) | ((u >> 8) << 8) | ((u & 0xff) << 16);
}

/** ADDI at, as, imm — AR[t] ← AR[s] + sext(imm8). */
export function ADDI(t: number, s: number, imm: number): number {
  range(imm, -128, 127, 'ADDI immediate');
  return rri8(0x00c002, 0, reg(s, 's'), reg(t, 't'), imm);
}

/** ADDMI at, as, imm — AR[t] ← AR[s] + (sext(imm8) << 8). */
export function ADDMI(t: number, s: number, imm: number): number {
  if (imm % 256 !== 0) throw new Error('ADDMI immediate must be a multiple of 256');
  range(imm, -32768, 32512, 'ADDMI immediate');
  return rri8(0x00d002, 0, reg(s, 's'), reg(t, 't'), imm >> 8);
}

// ── ALU (RRR: ar ← as op at) ─────────────────────────────────────────

export const ADD = (r: number, s: number, t: number): number =>
  rrr(0x800000, reg(r, 'r'), reg(s, 's'), reg(t, 't'));
export const SUB = (r: number, s: number, t: number): number =>
  rrr(0xc00000, reg(r, 'r'), reg(s, 's'), reg(t, 't'));
export const AND = (r: number, s: number, t: number): number =>
  rrr(0x100000, reg(r, 'r'), reg(s, 's'), reg(t, 't'));
export const OR = (r: number, s: number, t: number): number =>
  rrr(0x200000, reg(r, 'r'), reg(s, 's'), reg(t, 't'));
export const XOR = (r: number, s: number, t: number): number =>
  rrr(0x300000, reg(r, 'r'), reg(s, 's'), reg(t, 't'));

/** SLLI ar, as, sa (1..31) — encodes 32−sa in {op2 bit 20, t}. */
export function SLLI(r: number, s: number, sa: number): number {
  range(sa, 1, 31, 'SLLI shift');
  const enc = 32 - sa;
  return 0x010000 | ((enc & 0x10) << 16) | (reg(r, 'r') << 12) | (reg(s, 's') << 8) | ((enc & 0xf) << 4);
}

/** SRLI ar, at, sa (0..15) — sa in s. */
export function SRLI(r: number, t: number, sa: number): number {
  range(sa, 0, 15, 'SRLI shift');
  return 0x410000 | (reg(r, 'r') << 12) | (sa << 8) | (reg(t, 't') << 4);
}

/** SRAI ar, at, sa (0..31) — sa in {op2 bit 20, s}. */
export function SRAI(r: number, t: number, sa: number): number {
  range(sa, 0, 31, 'SRAI shift');
  return 0x210000 | ((sa & 0x10) << 16) | (reg(r, 'r') << 12) | ((sa & 0xf) << 8) | (reg(t, 't') << 4);
}

// ── Loads / stores (zero-extended scaled offsets) ────────────────────

export function L32I(t: number, s: number, off: number): number {
  range(off, 0, 1020, 'L32I offset');
  if (off % 4 !== 0) throw new Error('L32I offset must be 4-aligned');
  return rri8(0x002002, 0, reg(s, 's'), reg(t, 't'), off >> 2);
}
export function S32I(t: number, s: number, off: number): number {
  range(off, 0, 1020, 'S32I offset');
  if (off % 4 !== 0) throw new Error('S32I offset must be 4-aligned');
  return rri8(0x006002, 0, reg(s, 's'), reg(t, 't'), off >> 2);
}
export function L8UI(t: number, s: number, off: number): number {
  range(off, 0, 255, 'L8UI offset');
  return rri8(0x000002, 0, reg(s, 's'), reg(t, 't'), off);
}
export function S8I(t: number, s: number, off: number): number {
  range(off, 0, 255, 'S8I offset');
  return rri8(0x004002, 0, reg(s, 's'), reg(t, 't'), off);
}
export function L16UI(t: number, s: number, off: number): number {
  range(off, 0, 510, 'L16UI offset');
  if (off % 2 !== 0) throw new Error('L16UI offset must be 2-aligned');
  return rri8(0x001002, 0, reg(s, 's'), reg(t, 't'), off >> 1);
}
export function S16I(t: number, s: number, off: number): number {
  range(off, 0, 510, 'S16I offset');
  if (off % 2 !== 0) throw new Error('S16I offset must be 2-aligned');
  return rri8(0x005002, 0, reg(s, 's'), reg(t, 't'), off >> 1);
}

// ── Branches ─────────────────────────────────────────────────────────
// Taken target = PC + sext(imm) + 4. All our instructions are 3 bytes,
// so BR(n) gives the imm8/imm12 that jumps n instructions forward
// (n may be negative; n=0 would re-execute the next instruction's
// fall through). BR(1) skips one instruction; BR(-2) loops two back.
// Works for J too (same target arithmetic).

/** Branch displacement helper: n instructions relative to the NEXT one. */
export function BR(n: number): number {
  return 3 * n - 1; // PC + (3n−1) + 4 = PC + 3 + 3n = next + 3n
}

const condBranch = (op: number, s: number, t: number, imm8: number): number => {
  range(imm8, -128, 127, 'branch offset');
  return rri8(op, 0, reg(s, 's'), reg(t, 't'), imm8);
};

export const BEQ = (s: number, t: number, imm8: number): number => condBranch(0x001007, s, t, imm8);
export const BNE = (s: number, t: number, imm8: number): number => condBranch(0x009007, s, t, imm8);
export const BLT = (s: number, t: number, imm8: number): number => condBranch(0x002007, s, t, imm8);
export const BGE = (s: number, t: number, imm8: number): number => condBranch(0x00a007, s, t, imm8);
export const BLTU = (s: number, t: number, imm8: number): number => condBranch(0x003007, s, t, imm8);
export const BGEU = (s: number, t: number, imm8: number): number => condBranch(0x00b007, s, t, imm8);

/** BEQZ as, imm12 — branch if AR[s] == 0. */
export function BEQZ(s: number, imm12: number): number {
  range(imm12, -2048, 2047, 'BEQZ offset');
  return 0x000016 | (reg(s, 's') << 8) | ((imm12 & 0xfff) << 12);
}
/** BNEZ as, imm12. */
export function BNEZ(s: number, imm12: number): number {
  range(imm12, -2048, 2047, 'BNEZ offset');
  return 0x000056 | (reg(s, 's') << 8) | ((imm12 & 0xfff) << 12);
}

// ── Jumps / calls ────────────────────────────────────────────────────

/** J — PC ← PC + sext(offset18) + 4. Offset in BYTES (use BR for instrs). */
export function J(offset18: number): number {
  range(offset18, -131072, 131071, 'J offset');
  return 0x000006 | ((offset18 & 0x3ffff) << 6);
}

/** JX as — PC ← AR[s]. */
export const JX = (s: number): number => 0x0000a0 | (reg(s, 's') << 8);

/** CALL0 — a0 ← PC+3; PC ← ((PC>>2) + sext(off18) + 1) << 2. */
export function CALL0(offset18: number): number {
  range(offset18, -131072, 131071, 'CALL0 offset');
  return 0x000005 | ((offset18 & 0x3ffff) << 6);
}

/** CALLX0 as — a0 ← PC+3; PC ← AR[s]. */
export const CALLX0 = (s: number): number => 0x0000c0 | (reg(s, 's') << 8);

// ── Windowed ABI (slice 3) ───────────────────────────────────────────

/** CALLX4/8/12 as — windowed indirect call (n = 1, 2, 3). */
export function CALLXN(n: number, s: number): number {
  range(n, 1, 3, 'CALLXn size');
  return 0x0000c0 | (n << 4) | (reg(s, 's') << 8);
}

/** ENTRY as, frameBytes — rotates the window by PS.CALLINC and
 *  allocates the frame (multiple of 8, 0..32760). s must be a0..a3. */
export function ENTRY(s: number, frameBytes: number): number {
  range(s, 0, 3, 'ENTRY register');
  range(frameBytes, 0, 32760, 'ENTRY frame');
  if (frameBytes % 8 !== 0) throw new Error('ENTRY frame must be a multiple of 8');
  return 0x000036 | (s << 8) | ((frameBytes >> 3) << 12);
}

export const RETW = (): number => 0x000090;

export const RET = (): number => 0x000080; // PC ← a0
export const NOP = (): number => 0x0020f0;
export const MEMW = (): number => 0x0020c0;

// ── 16-bit code-density forms ────────────────────────────────────────
// Narrow builders return { w16 } so layout knows their width.

export interface Narrow {
  w16: number;
}

/** MOV.N at, as — AR[t] ← AR[s]. */
export function MOV_N(t: number, s: number): Narrow {
  return { w16: 0x000d | (reg(t, 't') << 4) | (reg(s, 's') << 8) };
}

/** MOVI.N as, −32..95 — imm7 split bits[6:4]‖bits[15:12]. */
export function MOVI_N(s: number, imm: number): Narrow {
  range(imm, -32, 95, 'MOVI.N immediate');
  const imm7 = imm & 0x7f;
  return { w16: 0x000c | (((imm7 >> 4) & 0x7) << 4) | (reg(s, 's') << 8) | ((imm7 & 0xf) << 12) };
}

/** ADD.N ar, as, at. */
export function ADD_N(r: number, s: number, t: number): Narrow {
  return { w16: 0x000a | (reg(t, 't') << 4) | (reg(s, 's') << 8) | (reg(r, 'r') << 12) };
}

/** ADDI.N ar, as, imm — imm is −1 or 1..15 (−1 encodes as t=0). */
export function ADDI_N(r: number, s: number, imm: number): Narrow {
  if (imm !== -1) range(imm, 1, 15, 'ADDI.N immediate');
  const t = imm === -1 ? 0 : imm;
  return { w16: 0x000b | (t << 4) | (reg(s, 's') << 8) | (reg(r, 'r') << 12) };
}

/** L32I.N at, as, 0..60 (4-aligned). */
export function L32I_N(t: number, s: number, off: number): Narrow {
  range(off, 0, 60, 'L32I.N offset');
  if (off % 4 !== 0) throw new Error('L32I.N offset must be 4-aligned');
  return { w16: 0x0008 | (reg(t, 't') << 4) | (reg(s, 's') << 8) | ((off >> 2) << 12) };
}

/** S32I.N at, as, 0..60 (4-aligned). */
export function S32I_N(t: number, s: number, off: number): Narrow {
  range(off, 0, 60, 'S32I.N offset');
  if (off % 4 !== 0) throw new Error('S32I.N offset must be 4-aligned');
  return { w16: 0x0009 | (reg(t, 't') << 4) | (reg(s, 's') << 8) | ((off >> 2) << 12) };
}

export const RET_N = (): Narrow => ({ w16: 0xf00d });
export const RETW_N = (): Narrow => ({ w16: 0xf01d });
export const NOP_N = (): Narrow => ({ w16: 0xf03d });

// ── Program assembly ─────────────────────────────────────────────────

/** Placeholder resolved at layout time: L32R at, literals[index]. */
export interface L32RRef {
  l32r: { t: number; lit: number };
}

/** Placeholder resolved at layout time: CALL0 to code[index]. CALL0
 *  targets must be 4-byte aligned — pad with NOPs so the callee's
 *  byte offset lands on a multiple of 4 (the assembler checks). */
export interface Call0Ref {
  call0: { to: number; n: number };
}

/** Index-based control flow, resolved from the real layout. */
export interface FlowRef {
  flow:
    | { kind: 'j'; to: number }
    | { kind: 'bri8'; op: number; s: number; t: number; to: number }
    | { kind: 'bri12'; op: number; s: number; to: number }
    | { kind: 'ri6'; nez: boolean; s: number; to: number };
}

export type XtInstr = number | Narrow | L32RRef | Call0Ref | FlowRef;

/** Reference a literal-pool entry from code. */
export function L32R(t: number, lit: number): L32RRef {
  return { l32r: { t: reg(t, 'L32R target'), lit } };
}

/** Call the subroutine at code[index] (call0 ABI). */
export function CALL0_TO(index: number): Call0Ref {
  return { call0: { to: index, n: 0 } };
}

/** CALL4/8/12 to code[index] (windowed ABI; n = 1, 2, 3). */
export function CALLN_TO(n: number, index: number): Call0Ref {
  range(n, 1, 3, 'CALLn size');
  return { call0: { to: index, n } };
}

/** J to code[index]. */
export const J_TO = (to: number): FlowRef => ({ flow: { kind: 'j', to } });
export const BEQ_TO = (s: number, t: number, to: number): FlowRef =>
  ({ flow: { kind: 'bri8', op: 0x001007, s: reg(s, 's'), t: reg(t, 't'), to } });
export const BNE_TO = (s: number, t: number, to: number): FlowRef =>
  ({ flow: { kind: 'bri8', op: 0x009007, s: reg(s, 's'), t: reg(t, 't'), to } });
export const BEQZ_TO = (s: number, to: number): FlowRef =>
  ({ flow: { kind: 'bri12', op: 0x000016, s: reg(s, 's'), to } });
export const BNEZ_TO = (s: number, to: number): FlowRef =>
  ({ flow: { kind: 'bri12', op: 0x000056, s: reg(s, 's'), to } });
/** BEQZ.N to code[index] — forward only (imm6 is unsigned). */
export const BEQZ_N_TO = (s: number, to: number): FlowRef =>
  ({ flow: { kind: 'ri6', nez: false, s: reg(s, 's'), to } });
export const BNEZ_N_TO = (s: number, to: number): FlowRef =>
  ({ flow: { kind: 'ri6', nez: true, s: reg(s, 's'), to } });

const instrLen = (i: XtInstr): number =>
  typeof i === 'number' ? 3 : 'w16' in i ? 2 : 'flow' in i && i.flow.kind === 'ri6' ? 2 : 3;

/**
 * Lay out a bootable raw image for a given base address:
 *
 *   [J → code] [pad to 4] [literal pool] [code…]
 *
 * L32R can only reach BACKWARD (its 16-bit offset is one-extended), so
 * the pool sits between the entry jump and the code. Instructions may
 * mix 24-bit and 16-bit (narrow) forms; index-based *_TO placeholders
 * are resolved against the real byte layout. Returns the bytes to load
 * at `base`.
 */
export function assembleXtensa(base: number, literals: number[], code: XtInstr[]): Uint8Array {
  // Header: one J instruction (3 bytes) + 1 pad byte aligns the pool.
  const poolStart = 4;
  const codeStart = poolStart + literals.length * 4;

  // Pass 1: byte offset of every instruction.
  const at: number[] = [];
  let cursor = codeStart;
  for (const instr of code) {
    at.push(cursor);
    cursor += instrLen(instr);
  }
  const total = cursor;
  const offsetOf = (index: number, what: string): number => {
    const a = at[index];
    if (a === undefined) throw new Error(`${what} targets code[${String(index)}], outside the program`);
    return a;
  };

  const out = new Uint8Array(total);
  const putWord24 = (pos: number, word: number): void => {
    out[pos] = word & 0xff;
    out[pos + 1] = (word >> 8) & 0xff;
    out[pos + 2] = (word >> 16) & 0xff;
  };

  putWord24(0, J(codeStart - 0 - 4));

  literals.forEach((v, i) => {
    const a = poolStart + i * 4;
    out[a] = v & 0xff;
    out[a + 1] = (v >>> 8) & 0xff;
    out[a + 2] = (v >>> 16) & 0xff;
    out[a + 3] = (v >>> 24) & 0xff;
  });

  code.forEach((instr, i) => {
    const pos = at[i] ?? 0;
    if (typeof instr === 'number') {
      putWord24(pos, instr);
      return;
    }
    if ('w16' in instr) {
      out[pos] = instr.w16 & 0xff;
      out[pos + 1] = (instr.w16 >> 8) & 0xff;
      return;
    }
    if ('call0' in instr) {
      const target = base + offsetOf(instr.call0.to, 'CALLn');
      if (target % 4 !== 0) {
        throw new Error(
          `CALLn target code[${String(instr.call0.to)}] is at 0x${target.toString(16)} — not 4-aligned (pad with NOPs)`,
        );
      }
      const pc = base + pos;
      const off = (target >> 2) - (pc >> 2) - 1;
      putWord24(pos, CALL0(off) | (instr.call0.n << 4));
      return;
    }
    if ('flow' in instr) {
      const f = instr.flow;
      const pc = base + pos;
      const target = base + offsetOf(f.to, f.kind);
      const rel = target - pc - 4;
      if (f.kind === 'j') {
        putWord24(pos, J(rel));
      } else if (f.kind === 'bri8') {
        range(rel, -128, 127, 'branch reach');
        putWord24(pos, f.op | (f.t << 4) | (f.s << 8) | ((rel & 0xff) << 16));
      } else if (f.kind === 'bri12') {
        range(rel, -2048, 2047, 'branch reach');
        putWord24(pos, f.op | (f.s << 8) | ((rel & 0xfff) << 12));
      } else {
        // RI6 narrow branch: zero-extended, forward only.
        if (rel < 0 || rel > 63) {
          throw new Error(`BEQZ.N/BNEZ.N can only reach 0..63 bytes FORWARD (got ${String(rel)})`);
        }
        const w = 0x008c | (f.nez ? 0x40 : 0) | (((rel >> 4) & 0x3) << 4) | (f.s << 8) | ((rel & 0xf) << 12);
        out[pos] = w & 0xff;
        out[pos + 1] = (w >> 8) & 0xff;
      }
      return;
    }
    // L32R
    const { t, lit } = instr.l32r;
    if (lit < 0 || lit >= literals.length) {
      throw new Error(`L32R literal index ${String(lit)} out of pool (size ${String(literals.length)})`);
    }
    const pc = base + pos;
    const litAddr = base + poolStart + lit * 4;
    const anchor = (pc + 3) & ~3;
    const offset = litAddr - anchor;
    if (offset >= 0 || offset < -(1 << 18) || offset % 4 !== 0) {
      throw new Error(`L32R cannot reach literal ${String(lit)} (offset ${String(offset)})`);
    }
    putWord24(pos, 0x000001 | (t << 4) | (((offset >> 2) & 0xffff) << 8));
  });

  return out;
}
