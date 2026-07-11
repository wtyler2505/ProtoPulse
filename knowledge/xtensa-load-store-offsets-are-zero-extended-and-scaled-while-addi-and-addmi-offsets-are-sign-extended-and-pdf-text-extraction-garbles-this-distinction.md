---
description: "Xtensa L32I/L16UI/L8UI (and S* stores) zero-extend then scale the RRI8 imm8; ADDI/ADDMI sign-extend. The Espressif overview PDF's text extraction flattens both to 'sign extend' — a verification-breaking garble."
type: claim
audience:
- intermediate
- expert
confidence: verified
created: 2026-06-23
topics:
- "[[xtensa]]"
- "[[emulation]]"
- "[[microcontrollers]]"
provenance:
- source: "2026-06-11-esp32s3-emulator-core-verification"
  note: "Esp32s3Core Xtensa LX7 interpreter verification; two independent sources per fact"
  verified: 2026-06-23
- source: "pfalcon/ida-xtensa2 xtensa.py disassembler"
  note: "exact opcode/mask constants, cross-checked against real objdump byte sequences"
---
# Xtensa load and store offsets are zero-extended and scaled while ADDI and ADDMI offsets are sign-extended and PDF text extraction garbles this distinction

When emulating the Xtensa LX7 core for `@protopulse/emu`, the RRI8 8-bit immediate (`imm8 = bits[23:16]`) is decoded two incompatibly different ways depending on the instruction class, and getting it wrong silently corrupts every effective-address computation.

For the load/store family the offset is **zero-extended and then scaled by the access width**. Concretely: `L32I`/`S32I` use `imm8 << 2` (word-aligned, 0–1020 byte range), `L16UI`/`S16I` use `imm8 << 1` (halfword, 0–510), and `L8UI`/`S8I` use the raw `imm8` (byte, 0–255). Because the value is zero-extended, these offsets are strictly non-negative — a load offset can never reach backward. That matches the hardware's intent: structure-member access off a base pointer is forward-only and naturally aligned, so the encoding bakes the scale in and spends no bit on a sign.

The arithmetic-immediate instructions break that pattern. `ADDI at, as, imm8` **sign-extends** its imm8, giving −128…+127, and `ADDMI at, as, imm8` sign-extends *and* shifts left by 8, giving a coarse ±32 KiB step used to build large constants in two instructions. Pointer arithmetic must be able to go both directions, hence sign extension; addressing offsets need not, hence zero extension.

The verification-breaking trap is documentary, not silicon. The Espressif "Overview of Xtensa ISA" PDF, when its text is machine-extracted, **flattens the scaled zero-extend of the load/store offsets into the words "sign extend"** — collapsing two distinct semantics into one wrong label. An emulator author trusting the extracted text would sign-extend load offsets, scale incorrectly, and produce addresses that are usually right (small positive offsets look identical under both schemes) but fail exactly on the edge cases that matter. The fix is to cross-check the encoding against a working disassembler (ida-xtensa2's `xtensa.py`) and the authoritative Reference Manual rather than the lossy PDF text layer — the same [[two-source-verification-resolves-silicon-facts-that-a-single-garbled-vendor-pdf-leaves-ambiguous|"two independent sources per fact" discipline]] the rest of the core verification used; this very garble is one of its motivating cases.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-uses-a-fixed-op0-t-s-r-op1-op2-field-layout-with-format-specific-immediates-and-a-verified-opcode-constant-table]] — the consolidated encoding reference; this note is the precise decode rule for one of its format-specific immediate classes (the RRI8 `imm8`).
- [[a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings]] — generalizes the verification lesson; *this* garble (load/store zero-extend flattened to "sign extend") is its motivating example.
- [[xtensa-l32r-always-addresses-backward-from-a-4-aligned-pc-because-its-16-bit-immediate-is-one-extended]] — the third extension rule (one-extend) in the same ISA; conflating extension schemes is the shared decoder-bug theme.
- [[xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4-while-sequential-flow-advances-pc-by-3]] — branch `imm8`/`imm12` are sign-extended like `ADDI`/`ADDMI`, contrasting with the zero-extended load/store offsets here.

Topics:
- [[xtensa]]
- [[emulation]]
- [[microcontrollers]]
