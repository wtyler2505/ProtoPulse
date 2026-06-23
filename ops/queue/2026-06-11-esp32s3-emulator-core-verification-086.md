---
claim: "the ESP32-S3 Xtensa LX7 24-bit instruction encoding uses a fixed op0/t/s/r/op1/op2 field layout with format-specific immediates and a verified opcode-constant table"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
note_type: reference
---

# Claim 086: esp32s3 xtensa lx7 24-bit instruction encoding reference

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 6-44,74-94)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED reference note (consolidated verified register/encoding data — kept as one retrievable table rather than fragmented into dozens of trivial atomic notes, per the composability/clean-linking test).

Rationale: Consolidates the field layout (op0=[3:0]...op2=[23:20]), RRI8/RI16/BRI12/CALL immediate formats, and the implemented opcode constants (L32R 0x000001 ... NOP 0x0020f0) plus 16-bit code-density forms — reference data, not 30 atomic notes.

Semantic neighbor: none — net-new register-level reference data.

---

## Create

Created reference note: `knowledge/the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-uses-a-fixed-op0-t-s-r-op1-op2-field-layout-with-format-specific-immediates-and-a-verified-opcode-constant-table.md`

Emitted as `type: reference` (consolidated retrievable table, not atomic claim). Summary: presents the fixed 24-bit field layout (op0=[3:0], t=[7:4], s=[11:8], r=[15:12], op1=[19:16], op2=[23:20]), the four immediate formats (RRI8 imm8=[23:16], RI16 imm16=[23:8], BRI12 imm12=[23:12], CALL offset18=[23:6]) with verified treatment (branch PC+4, L32R one-extend, load/store zero-extend+scale, ADDI sign-extend), and the full verified opcode-constant table (L32R 0x000001 … NOP 0x0020f0) from ida-xtensa2 cross-checked against the Espressif/Cadence ISA docs. Includes a 16-bit code-density addendum table marked as NOT implemented (honest cut). Inline links: branch-targets (066), L32R (067), load-store-offsets, the 24-bit-sufficiency cut, the cuts-documentation principle, and oracle-escalation. claim-084 (disassembler oracle) and claim-088 (special-registers) do not yet exist as discrete notes in knowledge/, so were not linked.

## connect
(to be filled by connect phase)

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
