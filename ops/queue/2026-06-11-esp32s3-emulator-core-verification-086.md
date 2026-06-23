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

Ran /connect --handoff (reflect phase, connect only). Dual discovery: topic maps [[xtensa]] + [[emulation]] AND filename scan of knowledge/ (qmd indexes main repo, not this worktree — siblings verified via ls).

MOC membership: already satisfied — the target is listed in both [[xtensa]] (## ISA encoding & decode, tagged "the master decode reference") and [[emulation]] (## Instruction set). No MOC edits needed.

Links added (target → siblings):
- [[a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings]] (084) — now exists in knowledge/; it is the oracle that verified the opcode-constant table in this note. The Create phase noted 084 "did not yet exist" and substituted the generic [[oracle-agent-escalation-is-the-strongest-debugging-path]]; 084 is the specific, genuine link, added alongside (generic link retained).
- [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]] (088) — now exists; companion reference table (special-register numbers + ISA config) for the same emulator core. The Create phase also noted 088 "did not yet exist."

Reciprocal link added (sibling → target): note 084 (disassembler-oracle) now links back to this master reference ("the opcode-constant table this disassembler oracle verified").

Reciprocity verified (no edit needed): the four decode-detail notes — branch-targets (066), L32R (067), load-store-offsets (065), 24-bit-only (064) — already link back to this master reference. The umbrella principle [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] is linked FROM instances by design (hub-and-spoke), so no back-link required.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
