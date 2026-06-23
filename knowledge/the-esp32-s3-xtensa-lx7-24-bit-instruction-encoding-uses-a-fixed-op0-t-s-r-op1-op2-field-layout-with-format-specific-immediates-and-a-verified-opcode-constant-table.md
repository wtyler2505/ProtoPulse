---
description: Reference table for Xtensa LX7 24-bit encoding — op0/t/s/r/op1/op2 fields, RRI8/RI16/BRI12/CALL immediates, and verified opcode constants.
type: reference
confidence: verified
audience: [expert]
created: 2026-06-23
topics:
  - xtensa
  - emulation
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---

# ESP32-S3 Xtensa LX7 24-bit instruction encoding reference

The Xtensa LX7 core (as emulated by `@protopulse/emu`'s `Esp32s3Core`, call0
ABI) decodes a 24-bit, little-endian core instruction into a fixed set of
named bit-fields. Every instruction reuses the same field positions; what
varies is which fields carry the opcode discriminator (`op0`/`op1`/`op2`) and
which carry register selectors (`t`/`s`/`r`) or a packed immediate. Decode is
therefore: read the byte triple little-endian into a 24-bit word, slice the
fixed fields, then dispatch on the masked opcode constant. This note
consolidates the three layers needed to do that — the field layout, the
format-specific immediate packings, and the verified opcode-constant table —
as one retrievable reference rather than fragmenting into trivial atoms.

Two independent sources back every value: the Espressif "Overview of Xtensa
ISA" PDF / Cadence "Xtensa ISA Reference Manual" (field layouts + semantics)
and `pfalcon/ida-xtensa2`'s `xtensa.py` working disassembler (exact
opcode/mask constants, cross-checked against real `objdump` byte sequences).

## Fixed field layout (24-bit word, little-endian)

| Field | Bits   | Role |
|-------|--------|------|
| op0   | [3:0]  | primary opcode group |
| t     | [7:4]  | register/operand selector (often dest or 2nd source) |
| s     | [11:8] | register/operand selector (often 1st source) |
| r     | [15:12]| register/operand selector (often dest) |
| op1   | [19:16]| secondary opcode |
| op2   | [23:20]| tertiary opcode |

## Format-specific immediates

| Format | Immediate field | Notes |
|--------|-----------------|-------|
| RRI8   | imm8 = bits[23:16]  | load/store + ADDI family |
| RI16   | imm16 = bits[23:8]  | L32R literal offset |
| BRI12  | imm12 = bits[23:12] | conditional branch displacement |
| CALL   | offset18 = bits[23:6] | CALL0 / J target |

Immediate treatment (verified against real encodings; the PDF's text
extraction garbles some of these):

- **Branches (RRI8/BRI12):** taken `PC ← PC + sext(imm) + 4`; not-taken `PC += 3`.
- **J:** `PC ← PC + sext(offset18) + 4`.
- **CALL0:** `a0 ← PC+3`; `PC ← ((PC>>2) + sext(offset18) + 1) << 2`.
- **RET:** `PC ← a0` (encoding `0x000080`).
- **L32R:** `addr = ((PC+3) & ~3) + (one_extend(imm16) << 2)` — always backward.
- **MOVI at, imm12:** register in `t`; `imm12 = s‖imm8` (verified: `movi a2, 63` = `22 a0 3f`).
- **Load/store offsets are zero-extended and scaled:** L32I/S32I `imm8<<2`,
  L16UI/S16I `imm8<<1`, L8UI/S8I `imm8`. ADDI/ADDMI are the sign-extended ones.
- **Shifts:** SLLI encodes `32−sa` in `{op2[0], t}` (src in `s`); SRLI `sa` in
  `s` (src in `t`); SRAI `sa` in `{op2[0], s}` (src in `t`); dest in `r`.

## Verified opcode constants (masks honored, from ida-xtensa2)

| Mnemonic | Opcode    | Mnemonic | Opcode    | Mnemonic | Opcode    |
|----------|-----------|----------|-----------|----------|-----------|
| L32R     | 0x000001  | ADD      | 0x800000  | BEQ      | 0x001007  |
| MOVI     | 0x00a002  | SUB      | 0xc00000  | BNE      | 0x009007  |
| ADDI     | 0x00c002  | AND      | 0x100000  | BLT      | 0x002007  |
| ADDMI    | 0x00d002  | OR       | 0x200000  | BGE      | 0x00a007  |
| L32I     | 0x002002  | XOR      | 0x300000  | BLTU     | 0x003007  |
| S32I     | 0x006002  | SLLI     | 0x010000  | BGEU     | 0x00b007  |
| L8UI     | 0x000002  | SRLI     | 0x410000  | BEQZ     | 0x000016  |
| S8I      | 0x004002  | SRAI     | 0x210000  | BNEZ     | 0x000056  |
| L16UI    | 0x001002  | J        | 0x000006  | JX       | 0x0000a0  |
| S16I     | 0x005002  | CALL0    | 0x000005  | CALLX0   | 0x0000c0  |
| RET      | 0x000080  | MEMW     | 0x0020c0  | NOP      | 0x0020f0  |

## 16-bit code-density forms (addendum — NOT implemented by the core)

The ESP toolchain assembler emits only 24-bit instructions, so the emulator
implements no 16-bit forms. The decode details below are documented for
reference (settled against the full Cadence ISA RM, which fixes overview text
that the PDF extraction garbled). Windowed-ABI instructions
(ENTRY/CALL8/RETW) are likewise not implemented — call0 ABI only.

| Form     | Decode detail |
|----------|---------------|
| MOV.N at, as | `AR[t] ← AR[s]` (dest in `t`; the overview's pseudo was transposed) |
| MOVI.N as, -32..95 | reg in `s`; `imm7 = bits[6:4]‖bits[15:12]`, sign-extended via AND of its two MSBs (asymmetric range) |
| BEQZ.N/BNEZ.N | `imm6 = bits[5:4]‖bits[15:12]`, zero-extended, forward-only (`target = PC + imm6 + 4`); bit7=1 marks RI6, bit6 selects NEZ |
| ADDI.N ar, as, imm | imm in `t`: `t=0` means −1, else 1..15 zero-extended |
| L32I.N/S32I.N at, as, 0..60 | `imm4` in `r`, zero-extended `<<2` |
| op0=0xd subspace | `r=0`→MOV.N; `r=0xf` with `t=0`→RET.N, `t=3`→NOP.N (RETW.N `t=1` windowed, refused). RET.N `0xf00d`, NOP.N `0xf03d` (cross-checked against ida-xtensa2) |

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

## Relevant Notes

- [[xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4-while-sequential-flow-advances-pc-by-3]] — branch displacement semantics (BRI12/RRI8 immediates above)
- [[xtensa-l32r-always-addresses-backward-from-a-4-aligned-pc-because-its-16-bit-immediate-is-one-extended]] — L32R RI16 one-extension detail
- [[xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction]] — RRI8 immediate scaling vs ADDI sign-extension
- [[emulating-only-24-bit-xtensa-core-instructions-is-sufficient-because-the-esp-toolchain-assembler-emits-no-16-bit-code-density-forms]] — why the 16-bit forms are an honest cut
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the cuts-documentation principle
- [[a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings]] — how the opcode-constant table above was verified (ida-xtensa2 over the garbled PDF)
- [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]] — companion reference table for RSR/WSR special-register numbers and ISA config constants
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] — disassembler-oracle escalation when decode disagrees with real bytes

## Topics

- [[xtensa]]
- [[emulation]]
