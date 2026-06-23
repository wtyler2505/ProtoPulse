---
name: Xtensa branch targets add the sign-extended immediate to PC plus 4 while sequential flow advances PC by 3
description: "Xtensa branch displacement is measured from the next-instruction boundary, so a taken branch is PC+sext(imm)+4 but a fall-through advances PC+=3"
type: claim
audience:
- intermediate
- expert
confidence: verified
created: 2026-06-23
reviewed: 2026-06-23
claims:
- "A taken Xtensa RRI8/BRI12 branch computes its target as PC + sext(imm) + 4"
- "Sequential (not-taken) flow advances PC by 3, the 24-bit core instruction width"
- "The +4 base differs from the +3 advance because displacement is anchored to a 4-byte next-instruction reference, not the actual instruction length"
topics:
- "[[xtensa]]"
- "[[emulation]]"
provenance:
- source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  note: Espressif "Overview of Xtensa ISA" PDF + pfalcon/ida-xtensa2 disassembler, cross-checked against real objdump byte sequences
  verified: 2026-06-23
---
# Xtensa branch targets add the sign-extended immediate to PC plus 4 while sequential flow advances PC by 3

An Xtensa LX7 core instruction is 24 bits wide, so an interpreter that takes a not-taken (sequential) path simply advances the program counter by 3 bytes: `PC += 3`. Yet when a branch is *taken*, the Xtensa ISA specifies the target as `PC ← PC + sext(imm) + 4` — note the `+4`, not `+3`. This asymmetry is the classic off-by-one trap for anyone writing a fresh emulator, because the two paths from the *same* instruction use two different PC increments.

The reason is that the branch displacement is not measured from the start of the branch instruction, nor even from the byte immediately after it. The architecture defines the displacement relative to a fixed **next-instruction reference point** of `PC + 4`. The sign-extended immediate field (8-bit `imm8` for RRI8 branches, 12-bit `imm12` for BRI12 branches) is the signed offset from that `PC+4` anchor to the target. So a branch whose immediate sign-extends to zero lands at `PC+4`, a backward branch subtracts from it, and a forward branch adds to it. The same `+4` anchor governs the absolute jump `J`, whose target is `PC + sext(offset18) + 4`.

Because the displacement base (`+4`) is decoupled from the instruction's actual encoded length (3 bytes), an emulator must treat these as two independent constants rather than reusing one "instruction size" value for both. A naive implementation that increments PC by 3 and then adds the immediate would land every taken branch one byte short of where silicon goes. Conversely, an implementation that adds 4 to the sequential path would skip a byte on every fall-through. The correct interpreter keeps them separate: `PC += 3` on fall-through, `PC = PC + sext(imm) + 4` on taken.

This is distinct from the other PC-relative forms in the same ISA: `CALL0` and `L32R` align to a 4-byte boundary via `(PC>>2)`/`(PC+3)&~3` arithmetic, so they cannot be modeled with the same `+4` displacement rule. Branches and `J` are the forms that use the flat `+4` next-instruction anchor.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-uses-a-fixed-op0-t-s-r-op1-op2-field-layout-with-format-specific-immediates-and-a-verified-opcode-constant-table]] — the consolidated encoding reference; the `PC + sext(imm) + 4` taken / `PC += 3` not-taken rule for BRI12/RRI8 (and J's `offset18`) is the precise control-flow expansion of its format-specific immediate table.
- [[xtensa-l32r-always-addresses-backward-from-a-4-aligned-pc-because-its-16-bit-immediate-is-one-extended]] — the contrasting PC-relative form: L32R one-extends imm16 against a 4-aligned `(PC+3)&~3` base, where branches sign-extend against a flat `PC+4` anchor. Conflating the two extension/base schemes is the classic decoder bug.
- [[xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction]] — branch `imm8`/`imm12` are sign-extended like ADDI/ADDMI, not zero-extended like load/store offsets; the third axis of the same extension-rule family.
- [[emulating-only-24-bit-xtensa-core-instructions-is-sufficient-because-the-esp-toolchain-assembler-emits-no-16-bit-code-density-forms]] — the `PC += 3` sequential advance *is* the 24-bit width that note justifies emulating exclusively; a 16-bit form would have advanced PC by 2.
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — another exact-PC-semantics fact the interpreter must honor precisely even while it skips all cycle/pipeline modeling.
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the umbrella principle this note instantiates: the +4/+3 increment is a *modeled* exactness the emulator must reproduce bit-for-bit (no cut allowed), the opposite end of the same trust contract that lets it document deliberate omissions elsewhere.

Topics:
- [[xtensa]]
- [[emulation]]
