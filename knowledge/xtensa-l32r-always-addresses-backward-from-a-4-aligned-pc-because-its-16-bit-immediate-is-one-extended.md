---
name: Xtensa L32R always addresses backward from a 4-aligned PC because its 16-bit immediate is one-extended
description: L32R one-extends its imm16 (so the scaled offset is always negative) and adds it to PC+3 masked to 4-alignment — the literal pool sits strictly before the instruction.
type: claim
audience:
- intermediate
- expert
confidence: verified
created: 2026-06-23
reviewed: 2026-06-23
topics:
- "[[xtensa]]"
- "[[emulation]]"
- "[[esp32-s3]]"
claims:
- "Xtensa L32R always addresses backward from a 4-aligned PC because its 16-bit immediate is one-extended"
provenance:
- source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  note: ISA semantics garble-checked against the Xtensa ISA reference and ida-xtensa2 opcode constants
  verified: 2026-06-23
  verifier: ralph create phase (claim-067)
---
# Xtensa L32R always addresses backward from a 4-aligned PC because its 16-bit immediate is one-extended

L32R is the Xtensa instruction that loads a 32-bit constant from the *literal pool* — a block of 4-byte aligned constants the assembler emits ahead of the code that uses them. Because immediates large enough to need a literal cannot be encoded inline, the CPU instead encodes a PC-relative offset to where the constant already lives. The exact effective-address computation is `addr = ((PC + 3) & ~3) + (one_extend(imm16) << 2)`. Two design choices in that formula make the access *always* reach backward, and an emulator's decoder must honor both or it will read garbage.

First, the base is not the raw PC but `(PC + 3) & ~3`: the address of the instruction *after* this 3-byte L32R, rounded *down* to the nearest 4-byte boundary. Rounding down (clearing the low two bits) guarantees the base is 4-aligned, which matches the 4-byte granularity the literal pool is laid out on — and it is the reason the literal table can be addressed in 4-byte steps by a scaled offset.

Second, the 16-bit field is *one-extended*, not sign- or zero-extended. One-extension fills the upper 16 bits with 1s, so the value is always negative (its range is roughly −262144 to −4 bytes after the `<<2` scale). Adding a strictly-negative term to the aligned base means the resulting address is always *below* the instruction. That is why the literal pool sits backward from the code that references it — the encoding cannot express a forward L32R at all.

This contrasts sharply with the branch/jump family in the same ISA, where the offset is *sign*-extended (so it can reach forward or backward) and the base is `PC + 4` with no alignment masking. Conflating the two extension rules is the classic decoder bug: a decoder that sign-extends L32R's imm16 will produce forward addresses for small positive-looking values and miss the literal entirely.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-uses-a-fixed-op0-t-s-r-op1-op2-field-layout-with-format-specific-immediates-and-a-verified-opcode-constant-table]] — the RI16 imm16 this note one-extends lives in that encoding reference's immediate table; this note is the L32R drill-in
- [[xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction]] — the third immediate-extension rule: load/store offsets are zero-extended (forward-only), ADDI sign-extended (bidirectional), L32R one-extended (backward-only) — three different decodings of the same encoding bits
- [[xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4-while-sequential-flow-advances-pc-by-3]] — the contrasting PC-relative form: sign-extended (reaches both ways) off a PC+4 base with no alignment masking, vs L32R's one-extended offset off the (PC+3)&~3 aligned base
- [[a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings]] — why the one-extend-vs-sign-extend distinction had to be settled against ida-xtensa2 rather than the garbled overview PDF

Topics:
- [[xtensa]]
- [[emulation]]
- [[esp32-s3]]
