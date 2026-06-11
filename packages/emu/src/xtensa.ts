/**
 * Xtensa LX7 interpreter — the deliberately small subset the ESP32-S3
 * core executes: the 24-bit core instructions of the call0 ABI plus
 * the 16-bit code-density forms (slice 2 — GCC emits .N forms densely,
 * so density support is the first step toward running compiler
 * output). No register windows (ENTRY/CALL8/RETW/RETW.N throw), no
 * interrupts, no special registers. Every unimplemented encoding
 * throws with its address and bytes — this core refuses loudly rather
 * than guessing. Encodings + semantics verified against the Espressif
 * ISA overview, the full Cadence ISA RM, and the ida-xtensa2 tables
 * (see inbox/2026-06-11-esp32s3-emulator-core-verification.md).
 */

export interface XtensaBus {
  read(addr: number, bytes: 1 | 2 | 4): number;
  write(addr: number, bytes: 1 | 2 | 4, value: number): void;
}

const sext = (v: number, bits: number): number => (v << (32 - bits)) >> (32 - bits);

export class XtensaCpu {
  /** a0..a15. a1 is the stack pointer by ABI convention. */
  readonly ar = new Int32Array(16);
  pc = 0;
  /** Instructions retired (1 instruction = 1 cycle in this model). */
  cycles = 0;

  constructor(private readonly bus: XtensaBus) {}

  reset(pc: number, sp: number): void {
    this.ar.fill(0);
    this.ar[1] = sp | 0;
    this.pc = pc;
    this.cycles = 0;
  }

  /** Execute one instruction. */
  step(): void {
    const pc = this.pc;
    const b0 = this.bus.read(pc, 1);
    const b1 = this.bus.read(pc + 1, 1);
    const ar = this.ar;

    // op0 8..13 are the 16-bit code-density formats (Cadence ISA RM).
    const op0lo = b0 & 0xf;
    if (op0lo >= 0x8 && op0lo <= 0xd) {
      const w = b0 | (b1 << 8);
      const nt = (w >> 4) & 0xf;
      const ns = (w >> 8) & 0xf;
      const nr = (w >> 12) & 0xf;
      let next = pc + 2;
      const badN = (): never => {
        throw new Error(
          `unimplemented Xtensa instruction at 0x${pc.toString(16)}: ` +
            `${b0.toString(16).padStart(2, '0')} ${b1.toString(16).padStart(2, '0')} ` +
            `(density form outside the supported set — windowed forms are refused)`,
        );
      };
      switch (op0lo) {
        case 0x8: // L32I.N at, as, imm4<<2
          ar[nt] = this.bus.read((((ar[ns] ?? 0) >>> 0) + (nr << 2)) >>> 0, 4) | 0;
          break;
        case 0x9: // S32I.N
          this.bus.write((((ar[ns] ?? 0) >>> 0) + (nr << 2)) >>> 0, 4, (ar[nt] ?? 0) >>> 0);
          break;
        case 0xa: // ADD.N ar, as, at
          ar[nr] = ((ar[ns] ?? 0) + (ar[nt] ?? 0)) | 0;
          break;
        case 0xb: // ADDI.N ar, as, (t=0 → −1, else t)
          ar[nr] = ((ar[ns] ?? 0) + (nt === 0 ? -1 : nt)) | 0;
          break;
        case 0xc: {
          if ((w & 0x80) === 0) {
            // MOVI.N as, −32..95 — imm7 = bits[6:4]‖bits[15:12], sign
            // bit = AND of imm7's two top bits (RM: asymmetric range).
            const imm7 = (((w >> 4) & 0x7) << 4) | nr;
            ar[ns] = (imm7 & 0x60) === 0x60 ? imm7 - 128 : imm7;
          } else {
            // RI6: BEQZ.N / BNEZ.N — imm6 zero-extended, forward only.
            const imm6 = (((w >> 4) & 0x3) << 4) | nr;
            const v = ar[ns] ?? 0;
            const taken = (w & 0x40) === 0 ? v === 0 : v !== 0;
            if (taken) next = pc + imm6 + 4;
          }
          break;
        }
        case 0xd: {
          if (nr === 0x0) {
            ar[nt] = ar[ns] ?? 0; // MOV.N at, as
          } else if (nr === 0xf && nt === 0x0) {
            next = ar[0] ?? 0; // RET.N
          } else if (nr === 0xf && nt === 0x3) {
            // NOP.N
          } else {
            badN(); // RETW.N (windowed), ILL.N, BREAK.N…
          }
          break;
        }
        default:
          badN();
      }
      this.pc = next >>> 0;
      this.cycles++;
      return;
    }

    const b2 = this.bus.read(pc + 2, 1);
    const word = b0 | (b1 << 8) | (b2 << 16);

    const op0 = word & 0xf;
    const t = (word >> 4) & 0xf;
    const s = (word >> 8) & 0xf;
    const r = (word >> 12) & 0xf;
    const imm8 = (word >> 16) & 0xff;
    let next = pc + 3;

    const bad = (): never => {
      throw new Error(
        `unimplemented Xtensa instruction at 0x${pc.toString(16)}: ` +
          `${b0.toString(16).padStart(2, '0')} ${b1.toString(16).padStart(2, '0')} ${b2.toString(16).padStart(2, '0')} ` +
          `(this core runs the 24-bit call0 subset only)`,
      );
    };

    switch (op0) {
      case 0x0: {
        // QRST space: RRR ALU ops, shifts, jumps/calls-indirect, RET…
        if (word === 0x000080) {
          next = ar[0] ?? 0; // RET
        } else if (word === 0x0020f0 || word === 0x0020c0) {
          // NOP / MEMW (no memory reordering to order here)
        } else if ((word & 0xfff0ff) === 0x0000a0) {
          next = ar[s] ?? 0; // JX
        } else if ((word & 0xfff0ff) === 0x0000c0) {
          ar[0] = pc + 3; // CALLX0
          next = ar[s] ?? 0;
        } else if ((word & 0xff000f) === 0x800000) {
          ar[r] = ((ar[s] ?? 0) + (ar[t] ?? 0)) | 0; // ADD
        } else if ((word & 0xff000f) === 0xc00000) {
          ar[r] = ((ar[s] ?? 0) - (ar[t] ?? 0)) | 0; // SUB
        } else if ((word & 0xff000f) === 0x100000) {
          ar[r] = (ar[s] ?? 0) & (ar[t] ?? 0); // AND
        } else if ((word & 0xff000f) === 0x200000) {
          ar[r] = (ar[s] ?? 0) | (ar[t] ?? 0); // OR
        } else if ((word & 0xff000f) === 0x300000) {
          ar[r] = (ar[s] ?? 0) ^ (ar[t] ?? 0); // XOR
        } else if ((word & 0xef000f) === 0x010000) {
          // SLLI — sa = 32 − {op2[0], t}
          const enc = (((word >> 20) & 0x1) << 4) | t;
          ar[r] = (ar[s] ?? 0) << (32 - enc);
        } else if ((word & 0xff000f) === 0x410000) {
          ar[r] = (ar[t] ?? 0) >>> s; // SRLI
        } else if ((word & 0xef000f) === 0x210000) {
          const sa = (((word >> 20) & 0x1) << 4) | s;
          ar[r] = (ar[t] ?? 0) >> sa; // SRAI
        } else {
          bad();
        }
        break;
      }
      case 0x1: {
        // L32R: addr = ((PC+3) & ~3) + one_extend(imm16)<<2
        const imm16 = (word >> 8) & 0xffff;
        const offset = (imm16 | 0xffff0000) << 2;
        const addr = (((pc + 3) & ~3) + offset) | 0;
        ar[t] = this.bus.read(addr >>> 0, 4) | 0;
        break;
      }
      case 0x2: {
        // LSAI loads/stores + MOVI/ADDI/ADDMI, discriminated by r.
        switch (r) {
          case 0x0:
            ar[t] = this.bus.read(((ar[s] ?? 0) + imm8) >>> 0, 1); // L8UI
            break;
          case 0x1:
            ar[t] = this.bus.read(((ar[s] ?? 0) + (imm8 << 1)) >>> 0, 2); // L16UI
            break;
          case 0x2:
            ar[t] = this.bus.read(((ar[s] ?? 0) + (imm8 << 2)) >>> 0, 4) | 0; // L32I
            break;
          case 0x4:
            this.bus.write(((ar[s] ?? 0) + imm8) >>> 0, 1, (ar[t] ?? 0) & 0xff); // S8I
            break;
          case 0x5:
            this.bus.write(((ar[s] ?? 0) + (imm8 << 1)) >>> 0, 2, (ar[t] ?? 0) & 0xffff); // S16I
            break;
          case 0x6:
            this.bus.write(((ar[s] ?? 0) + (imm8 << 2)) >>> 0, 4, (ar[t] ?? 0) >>> 0); // S32I
            break;
          case 0xa:
            ar[t] = sext((s << 8) | imm8, 12); // MOVI
            break;
          case 0xc:
            ar[t] = ((ar[s] ?? 0) + sext(imm8, 8)) | 0; // ADDI
            break;
          case 0xd:
            ar[t] = ((ar[s] ?? 0) + (sext(imm8, 8) << 8)) | 0; // ADDMI
            break;
          default:
            bad();
        }
        break;
      }
      case 0x5: {
        // CALL0 (n=0): a0 ← PC+3; PC ← ((PC>>2) + sext(off18) + 1) << 2
        if (((word >> 4) & 0x3) !== 0) bad(); // CALL4/8/12 are windowed
        const off = sext(word >>> 6, 18);
        ar[0] = pc + 3;
        next = ((((pc >> 2) + off + 1) | 0) << 2) | 0;
        break;
      }
      case 0x6: {
        const n = (word >> 4) & 0x3;
        if (n === 0) {
          next = (pc + sext(word >>> 6, 18) + 4) | 0; // J
        } else if (n === 1 || n === 2) {
          // BEQZ/BNEZ (and BLTZ/BGEZ share the space via m) — we decode
          // the two we emit; the rest fall through to bad().
          const m = (word >> 6) & 0x3;
          const imm12 = sext((word >> 12) & 0xfff, 12);
          const v = ar[s] ?? 0;
          if (n === 1 && m === 0) {
            if (v === 0) next = (pc + imm12 + 4) | 0; // BEQZ
          } else if (n === 1 && m === 1) {
            if (v !== 0) next = (pc + imm12 + 4) | 0; // BNEZ
          } else {
            bad();
          }
        } else {
          bad();
        }
        break;
      }
      case 0x7: {
        // RRI8 conditional branches, discriminated by r.
        const off = sext(imm8, 8);
        const a = ar[s] ?? 0;
        const b = ar[t] ?? 0;
        let taken: boolean;
        switch (r) {
          case 0x1:
            taken = a === b; // BEQ
            break;
          case 0x9:
            taken = a !== b; // BNE
            break;
          case 0x2:
            taken = a < b; // BLT
            break;
          case 0xa:
            taken = a >= b; // BGE
            break;
          case 0x3:
            taken = a >>> 0 < b >>> 0; // BLTU
            break;
          case 0xb:
            taken = a >>> 0 >= b >>> 0; // BGEU
            break;
          default:
            return bad();
        }
        if (taken) next = (pc + off + 4) | 0;
        break;
      }
      default:
        bad();
    }

    this.pc = next >>> 0;
    this.cycles++;
  }
}
