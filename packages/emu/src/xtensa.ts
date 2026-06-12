/**
 * Xtensa LX7 interpreter — the ESP32-S3 core's CPU: 24-bit core
 * instructions, the 16-bit code-density forms (slice 2), the
 * windowed-register option (slice 3 — CALL4/8/12, ENTRY, RETW over a
 * 64-entry physical register file), and exceptions + level-1
 * interrupts with the CCOUNT/CCOMPARE core timer (slice 4 — RSR/WSR/
 * RSIL/RFE, EPC1/EXCSAVE1/EXCCAUSE/VECBASE/INTENABLE/INTERRUPT,
 * timer0 on interrupt line 6 per ESP32-S3's core-isa.h, vectoring to
 * VECBASE+0x340 with EXCCAUSE=Level1Interrupt). Exactly as the
 * Cadence ISA RM specifies.
 *
 * Window overflow/underflow is handled by MAGIC SPILL/FILL: instead of
 * raising the exception and running the standard handlers, the
 * interpreter performs the handlers' documented net effect directly —
 * a0..a3 of the spilled frame to [nextSP−16..−4], the extra 4 or 8
 * registers to [prevSP−32..−20] / [prevSP−48..−20], prevSP read from
 * [frameSP−12] — byte-for-byte the layout compiled code and debuggers
 * expect. The check runs lazily on first touch of a register group,
 * which matches the hardware's spill-and-retry fixpoint (spills never
 * change visible register values, only memory and WindowStart).
 *
 * Honest cuts: spill/fill and interrupt vectoring cost no extra
 * cycles (1 instruction = 1 cycle everywhere); MOVSP performs the
 * Alloca handler's net effect directly (save-area move — slice 5);
 * the handler-only L32E/S32E/RFWO/RFWU are refused; PS holds INTLEVEL +
 * EXCM (gating interrupts) but UM/WOE/RING are stored, not acted on;
 * the interrupt lines are the latched timer line (INT6) plus the
 * level-triggered external level-1 lines driven by the SoC through
 * setExtInt (slice 6) — no software lines, no edge-triggered external
 * lines; VECBASE alignment is not enforced; only level-1
 * interrupts (no medium/high-priority levels, no XSR). Everything
 * unimplemented throws with its address and bytes. Encodings +
 * semantics verified against the Espressif ISA overview, the full
 * Cadence ISA RM, and the ida-xtensa2 tables (see
 * inbox/2026-06-11-esp32s3-emulator-core-verification.md).
 */

export interface XtensaBus {
  read(addr: number, bytes: 1 | 2 | 4): number;
  write(addr: number, bytes: 1 | 2 | 4, value: number): void;
}

const sext = (v: number, bits: number): number => (v << (32 - bits)) >> (32 - bits);

/** Physical AR count — ESP32-S3 configures 64 (XCHAL_NUM_AREGS). */
const NAREG = 64;
const NWINDOWS = NAREG / 4; // WindowBase counts in groups of 4

/** The level-1 LEVEL-TRIGGERED external lines per ESP32-S3's
 *  core-isa.h: INT0-5, INT8-9, INT12-13, INT17-18. (INT6/7/10 are
 *  timer/software/edge — not drivable through setExtInt.) */
const LEVEL1_EXT_MASK = 0x3f | 0x300 | 0x3000 | (0x3 << 17);

export class XtensaCpu {
  /** The physical register file. Visible a0..a15 rotate over it. */
  readonly phys = new Int32Array(NAREG);
  windowBase = 0;
  /** Bit i set = a live (unspilled) frame starts at group i. */
  windowStart = 1;
  /** PS.CALLINC — set by CALLn, consumed by ENTRY. */
  private callinc = 0;
  pc = 0;
  /** Instructions retired (1 instruction = 1 cycle in this model). */
  cycles = 0;

  // ── Slice 4: exception + interrupt state ──
  /** PS: INTLEVEL [3:0], EXCM bit 4 (gating); UM/WOE stored only. */
  ps = 0xf; // reset with interrupts masked — firmware lowers via RSIL
  epc1 = 0;
  excsave1 = 0;
  exccause = 0;
  /** Vector base — resets to the ROM region per XCHAL_VECBASE_RESET_VADDR. */
  vecbase = 0x40000000;
  intenable = 0;
  /** LATCHED interrupt bits (the timer line; clearable via INTCLEAR). */
  interrupt = 0;
  /** Level-triggered external lines, driven by the SoC each time its
   *  interrupt sources change — they track the input, so INTCLEAR
   *  cannot clear them (the RM's rule for level-triggered lines). */
  private extInt = 0;
  private ccompare0 = 0;
  /** CCOUNT = (cycles + bias) >>> 0 — WSR.CCOUNT adjusts the bias. */
  private ccountBias = 0;

  constructor(private readonly bus: XtensaBus) {}

  reset(pc: number, sp: number): void {
    this.phys.fill(0);
    this.windowBase = 0;
    this.windowStart = 1;
    this.callinc = 0;
    this.phys[1] = sp | 0;
    this.pc = pc;
    this.cycles = 0;
    this.ps = 0xf;
    this.epc1 = 0;
    this.excsave1 = 0;
    this.exccause = 0;
    this.vecbase = 0x40000000;
    this.intenable = 0;
    this.interrupt = 0;
    this.extInt = 0;
    this.ccompare0 = 0;
    this.ccountBias = 0;
  }

  /** Drive the level-triggered external level-1 lines (the interrupt
   *  matrix's output). Bits outside LEVEL1_EXT_MASK are dropped. */
  setExtInt(mask: number): void {
    this.extInt = (mask & LEVEL1_EXT_MASK) >>> 0;
  }

  get ccount(): number {
    return (this.cycles + this.ccountBias) >>> 0;
  }

  /** Visible register a[i] of the CURRENT window (for inspection). */
  a(i: number): number {
    return this.phys[(this.windowBase * 4 + i) & (NAREG - 1)] ?? 0;
  }

  private ra(i: number): number {
    this.windowCheck(i >> 2);
    return this.phys[(this.windowBase * 4 + i) & (NAREG - 1)] ?? 0;
  }

  private wa(i: number, v: number): void {
    this.windowCheck(i >> 2);
    this.phys[(this.windowBase * 4 + i) & (NAREG - 1)] = v | 0;
  }

  private wsBit(group: number): boolean {
    return ((this.windowStart >> (group & (NWINDOWS - 1))) & 1) === 1;
  }

  /**
   * The RM's WindowCheck as a fixpoint: while a live frame overlaps
   * the referenced register group, spill the LOWEST such frame (the
   * hardware spills one and retries the instruction).
   */
  private windowCheck(maxGroup: number): void {
    if (maxGroup === 0) return;
    for (;;) {
      const wb = this.windowBase;
      let n: number;
      if (maxGroup >= 1 && this.wsBit(wb + 1)) n = 1;
      else if (maxGroup >= 2 && this.wsBit(wb + 2)) n = 2;
      else if (maxGroup >= 3 && this.wsBit(wb + 3)) n = 3;
      else return;
      const p = (wb + n) & (NWINDOWS - 1);
      const size = this.wsBit(p + 1) ? 1 : this.wsBit(p + 2) ? 2 : 3;
      this.spillFrame(p, size);
      this.windowStart &= ~(1 << p);
    }
  }

  /** The documented net effect of WindowOverflow{4,8,12} for the frame
   *  starting at group p, spanning `size` groups. */
  private spillFrame(p: number, size: number): void {
    const pv = (k: number): number => this.phys[(p * 4 + k) & (NAREG - 1)] ?? 0;
    const spNext = pv(size * 4 + 1) >>> 0; // next frame's a1
    for (let k = 0; k < 4; k++) {
      this.bus.write((spNext - 16 + 4 * k) >>> 0, 4, pv(k) >>> 0);
    }
    if (size >= 2) {
      const spPrev = this.bus.read(((pv(1) >>> 0) - 12) >>> 0, 4) >>> 0;
      for (let k = 4; k < size * 4; k++) {
        this.bus.write((spPrev - 16 * size + 4 * (k - 4)) >>> 0, 4, pv(k) >>> 0);
      }
    }
  }

  /** The documented net effect of WindowUnderflow{4,8,12}: reload the
   *  frame at group p (size groups) on return into it. `spNext` is the
   *  returning frame's a1 (read before rotation). */
  private fillFrame(p: number, size: number, spNext: number): void {
    const set = (k: number, v: number): void => {
      this.phys[(p * 4 + k) & (NAREG - 1)] = v | 0;
    };
    for (let k = 0; k < 4; k++) {
      set(k, this.bus.read((spNext - 16 + 4 * k) >>> 0, 4));
    }
    if (size >= 2) {
      const a1 = this.phys[(p * 4 + 1) & (NAREG - 1)] ?? 0;
      const spPrev = this.bus.read(((a1 >>> 0) - 12) >>> 0, 4) >>> 0;
      for (let k = 4; k < size * 4; k++) {
        set(k, this.bus.read((spPrev - 16 * size + 4 * (k - 4)) >>> 0, 4));
      }
    }
  }

  /** Take a pending enabled level-1 interrupt, per the RM's dispatch:
   *  EPC1 ← PC, EXCCAUSE ← Level1Interrupt(4), PS.EXCM ← 1,
   *  PC ← VECBASE + 0x340 (XCHAL_USER_VECOFS). */
  private maybeInterrupt(): void {
    if (((this.interrupt | this.extInt) & this.intenable) === 0) return;
    if ((this.ps & 0x10) !== 0) return; // EXCM blocks
    if ((this.ps & 0xf) >= 1) return; // INTLEVEL masks level-1
    this.epc1 = this.pc;
    this.exccause = 4;
    this.ps |= 0x10;
    this.pc = (this.vecbase + 0x340) >>> 0;
  }

  /** CCOUNT ticked to this value — latch the timer interrupt on match
   *  (cleared only by writing CCOMPARE0 or INTCLEAR, per the RM). */
  private tickCcount(): void {
    if (this.ccount === (this.ccompare0 >>> 0)) this.interrupt |= 1 << 6;
  }

  /** Execute one instruction. */
  step(): void {
    this.maybeInterrupt();
    const pc = this.pc;
    const b0 = this.bus.read(pc, 1);
    const b1 = this.bus.read(pc + 1, 1);

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
            `(density form outside the supported set)`,
        );
      };
      switch (op0lo) {
        case 0x8: // L32I.N at, as, imm4<<2
          this.wa(nt, this.bus.read(((this.ra(ns) >>> 0) + (nr << 2)) >>> 0, 4) | 0);
          break;
        case 0x9: // S32I.N
          this.bus.write(((this.ra(ns) >>> 0) + (nr << 2)) >>> 0, 4, this.ra(nt) >>> 0);
          break;
        case 0xa: // ADD.N ar, as, at
          this.wa(nr, (this.ra(ns) + this.ra(nt)) | 0);
          break;
        case 0xb: // ADDI.N ar, as, (t=0 → −1, else t)
          this.wa(nr, (this.ra(ns) + (nt === 0 ? -1 : nt)) | 0);
          break;
        case 0xc: {
          if ((w & 0x80) === 0) {
            // MOVI.N as, −32..95 — sign bit = AND of imm7's top two bits.
            const imm7 = (((w >> 4) & 0x7) << 4) | nr;
            this.wa(ns, (imm7 & 0x60) === 0x60 ? imm7 - 128 : imm7);
          } else {
            // RI6: BEQZ.N / BNEZ.N — imm6 zero-extended, forward only.
            const imm6 = (((w >> 4) & 0x3) << 4) | nr;
            const v = this.ra(ns);
            const taken = (w & 0x40) === 0 ? v === 0 : v !== 0;
            if (taken) next = pc + imm6 + 4;
          }
          break;
        }
        case 0xd: {
          if (nr === 0x0) {
            this.wa(nt, this.ra(ns)); // MOV.N at, as
          } else if (nr === 0xf && nt === 0x0) {
            next = this.ra(0); // RET.N
          } else if (nr === 0xf && nt === 0x1) {
            next = this.retw(pc); // RETW.N
          } else if (nr === 0xf && nt === 0x3) {
            // NOP.N
          } else {
            badN(); // ILL.N, BREAK.N…
          }
          break;
        }
        default:
          badN();
      }
      this.pc = next >>> 0;
      this.cycles++;
      this.tickCcount();
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
          `(outside this core's call0 + windowed subset)`,
      );
    };

    switch (op0) {
      case 0x0: {
        // QRST space: RRR ALU ops, shifts, jumps/calls-indirect, RET…
        if (word === 0x000080) {
          next = this.ra(0); // RET
        } else if (word === 0x000090) {
          next = this.retw(pc); // RETW
        } else if (word === 0x0020f0 || word === 0x0020c0) {
          // NOP / MEMW (no memory reordering to order here)
        } else if ((word & 0xfff0ff) === 0x0000a0) {
          next = this.ra(s); // JX
        } else if ((word & 0xfff0ff) === 0x0000c0) {
          this.wa(0, pc + 3); // CALLX0
          next = this.ra(s);
        } else if ((word & 0xfff0cf) === 0x0000c0) {
          // CALLX4/8/12 — n in bits[5:4]
          const n = (word >> 4) & 0x3;
          const target = this.ra(s);
          this.calln(n, pc);
          next = target;
        } else if ((word & 0xfff00f) === 0x001000) {
          // MOVSP at, as — if the caller's registers are NOT in the
          // register file (all three WindowStart bits below clear),
          // the RM raises Alloca; the magic net effect is the
          // handler's: move the 4-word base save area from below the
          // old SP to below the new one. Then the plain move.
          const wb = this.windowBase;
          const callerPresent = this.wsBit(wb - 1) || this.wsBit(wb - 2) || this.wsBit(wb - 3);
          const newSp = this.ra(s);
          if (!callerPresent) {
            const oldSp = this.ra(t) >>> 0;
            for (let k = 0; k < 4; k++) {
              this.bus.write(((newSp >>> 0) - 16 + 4 * k) >>> 0, 4, this.bus.read((oldSp - 16 + 4 * k) >>> 0, 4));
            }
          }
          this.wa(t, newSp);
        } else if (word === 0x003000) {
          // RFE: PS.EXCM ← 0; PC ← EPC1
          this.ps &= ~0x10;
          next = this.epc1;
        } else if ((word & 0xff000f) === 0x030000) {
          this.wa(t, this.readSr((word >> 8) & 0xff, pc)); // RSR
        } else if ((word & 0xff000f) === 0x130000) {
          this.writeSr((word >> 8) & 0xff, this.ra(t), pc); // WSR
        } else if ((word & 0xfff00f) === 0x006000) {
          // RSIL at, level: at ← PS; PS.INTLEVEL ← level
          this.wa(t, this.ps);
          this.ps = (this.ps & ~0xf) | s;
        } else if ((word & 0xff000f) === 0x800000) {
          this.wa(r, (this.ra(s) + this.ra(t)) | 0); // ADD
        } else if ((word & 0xff000f) === 0xc00000) {
          this.wa(r, (this.ra(s) - this.ra(t)) | 0); // SUB
        } else if ((word & 0xff000f) === 0x100000) {
          this.wa(r, this.ra(s) & this.ra(t)); // AND
        } else if ((word & 0xff000f) === 0x200000) {
          this.wa(r, this.ra(s) | this.ra(t)); // OR
        } else if ((word & 0xff000f) === 0x300000) {
          this.wa(r, this.ra(s) ^ this.ra(t)); // XOR
        } else if ((word & 0xef000f) === 0x010000) {
          // SLLI — sa = 32 − {op2[0], t}
          const enc = (((word >> 20) & 0x1) << 4) | t;
          this.wa(r, this.ra(s) << (32 - enc));
        } else if ((word & 0xff000f) === 0x410000) {
          this.wa(r, this.ra(t) >>> s); // SRLI
        } else if ((word & 0xef000f) === 0x210000) {
          const sa = (((word >> 20) & 0x1) << 4) | s;
          this.wa(r, this.ra(t) >> sa); // SRAI
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
        this.wa(t, this.bus.read(addr >>> 0, 4) | 0);
        break;
      }
      case 0x2: {
        // LSAI loads/stores + MOVI/ADDI/ADDMI, discriminated by r.
        switch (r) {
          case 0x0:
            this.wa(t, this.bus.read((this.ra(s) + imm8) >>> 0, 1)); // L8UI
            break;
          case 0x1:
            this.wa(t, this.bus.read((this.ra(s) + (imm8 << 1)) >>> 0, 2)); // L16UI
            break;
          case 0x2:
            this.wa(t, this.bus.read((this.ra(s) + (imm8 << 2)) >>> 0, 4) | 0); // L32I
            break;
          case 0x4:
            this.bus.write((this.ra(s) + imm8) >>> 0, 1, this.ra(t) & 0xff); // S8I
            break;
          case 0x5:
            this.bus.write((this.ra(s) + (imm8 << 1)) >>> 0, 2, this.ra(t) & 0xffff); // S16I
            break;
          case 0x6:
            this.bus.write((this.ra(s) + (imm8 << 2)) >>> 0, 4, this.ra(t) >>> 0); // S32I
            break;
          case 0xa:
            this.wa(t, sext((s << 8) | imm8, 12)); // MOVI
            break;
          case 0xc:
            this.wa(t, (this.ra(s) + sext(imm8, 8)) | 0); // ADDI
            break;
          case 0xd:
            this.wa(t, (this.ra(s) + (sext(imm8, 8) << 8)) | 0); // ADDMI
            break;
          default:
            bad();
        }
        break;
      }
      case 0x5: {
        // CALL0/4/8/12 — n in bits[5:4].
        const n = (word >> 4) & 0x3;
        const off = sext(word >>> 6, 18);
        const target = ((((pc >> 2) + off + 1) | 0) << 2) | 0;
        if (n === 0) {
          this.wa(0, pc + 3);
        } else {
          this.calln(n, pc);
        }
        next = target;
        break;
      }
      case 0x6: {
        const n = (word >> 4) & 0x3;
        if (n === 0) {
          next = (pc + sext(word >>> 6, 18) + 4) | 0; // J
        } else if (n === 1) {
          const m = (word >> 6) & 0x3;
          const imm12s = sext((word >> 12) & 0xfff, 12);
          const v = this.ra(s);
          if (m === 0) {
            if (v === 0) next = (pc + imm12s + 4) | 0; // BEQZ
          } else if (m === 1) {
            if (v !== 0) next = (pc + imm12s + 4) | 0; // BNEZ
          } else {
            bad();
          }
        } else if (n === 3 && ((word >> 6) & 0x3) === 0) {
          // ENTRY s, imm12 — new SP into the NEW window's a[s].
          const frame = ((word >> 12) & 0xfff) << 3;
          if (s > 3) bad(); // the RM restricts ENTRY to a0..a3
          const newSp = (this.ra(s) - frame) | 0;
          this.wa(this.callinc * 4 + s, newSp);
          this.windowBase = (this.windowBase + this.callinc) & (NWINDOWS - 1);
          this.windowStart |= 1 << this.windowBase;
          break;
        } else {
          bad();
        }
        break;
      }
      case 0x7: {
        // RRI8 conditional branches, discriminated by r.
        const off = sext(imm8, 8);
        const a = this.ra(s);
        const b = this.ra(t);
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
    this.tickCcount();
  }

  /** Special-register read (RSR). Unknown registers refuse loudly. */
  private readSr(sr: number, pc: number): number {
    switch (sr) {
      case 72: return this.windowBase;
      case 73: return this.windowStart;
      case 177: return this.epc1;
      case 209: return this.excsave1;
      case 226: return (this.interrupt | this.extInt) | 0;
      case 228: return this.intenable;
      case 230: return this.ps;
      case 231: return this.vecbase | 0;
      case 232: return this.exccause;
      case 234: return this.ccount | 0;
      case 240: return this.ccompare0;
      default:
        throw new Error(`RSR of unimplemented special register ${String(sr)} at 0x${pc.toString(16)}`);
    }
  }

  /** Special-register write (WSR). */
  private writeSr(sr: number, v: number, pc: number): void {
    switch (sr) {
      case 72: this.windowBase = v & (NWINDOWS - 1); break;
      case 73: this.windowStart = v & 0xffff; break;
      case 177: this.epc1 = v >>> 0; break;
      case 209: this.excsave1 = v | 0; break;
      case 227: this.interrupt &= ~v; break; // INTCLEAR
      case 228: this.intenable = v >>> 0; break;
      case 230: this.ps = v >>> 0; break;
      case 231: this.vecbase = v >>> 0; break;
      case 232: this.exccause = v & 0x3f; break;
      case 234: this.ccountBias = (v - this.cycles) | 0; break; // CCOUNT
      case 240:
        // Writing CCOMPARE0 clears the timer interrupt (RM rule).
        this.ccompare0 = v >>> 0;
        this.interrupt &= ~(1 << 6);
        break;
      default:
        throw new Error(`WSR of unimplemented special register ${String(sr)} at 0x${pc.toString(16)}`);
    }
  }

  /** CALLn (n=1,2,3): WindowCheck(n), PS.CALLINC ← n, a[4n] ← link. */
  private calln(n: number, pc: number): void {
    this.callinc = n;
    // wa() runs the overflow check for group n before writing the link.
    this.wa(n * 4, (n << 30) | ((pc + 3) & 0x3fffffff));
  }

  /** Shared RETW/RETW.N: rotate back per a0's encoded call size, with
   *  magic underflow fill. Returns the next PC. */
  private retw(pc: number): number {
    const a0v = this.ra(0);
    const n = (a0v >>> 30) & 3;
    if (n === 0) {
      throw new Error(
        `RETW at 0x${pc.toString(16)} with a call0-style link in a0 (0x${(a0v >>> 0).toString(16)}) — corrupt return address or ABI mix-up`,
      );
    }
    const wb = this.windowBase;
    const m = this.wsBit(wb - 1) ? 1 : this.wsBit(wb - 2) ? 2 : this.wsBit(wb - 3) ? 3 : 0;
    if (m !== 0 && m !== n) {
      throw new Error(
        `RETW at 0x${pc.toString(16)}: window frame size mismatch (caller frame says ${String(m)}, link says ${String(n)})`,
      );
    }
    const next = ((pc & 0xc0000000) | (a0v & 0x3fffffff)) >>> 0;
    const newWb = (wb - n) & (NWINDOWS - 1);
    if (!this.wsBit(newWb)) {
      // Underflow: reload the caller's frame from its documented slots.
      this.fillFrame(newWb, n, this.ra(1) >>> 0);
    }
    this.windowStart &= ~(1 << wb);
    this.windowStart |= 1 << newWb;
    this.windowBase = newWb;
    return next;
  }
}
