---
claim: "the ESP32-S3 Xtensa special-register numbers, RSR WSR RSIL RFE encodings, EXCCAUSE codes, and core-isa config constants are fixed values an emulator must hardcode"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
note_type: reference
---

# Claim 088: esp32s3 xtensa special-register and exccause reference

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 128-156)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED reference note (consolidated verified register/encoding data — kept as one retrievable table rather than fragmented into dozens of trivial atomic notes, per the composability/clean-linking test).

Rationale: Consolidates SR numbers (EPC1 177, EXCSAVE1 209, INTENABLE 228, PS 230, VECBASE 231, EXCCAUSE 232, CCOUNT 234, CCOMPARE0-2 240-242), the RSR/WSR/RSIL/RFE encodings, EXCCAUSE 0-5, and ESP32-S3 core-isa constants (INT6 timer L1, VECBASE 0x40000000, 64 ARs, 3 timers).

Semantic neighbor: none — net-new register-level reference data.

---

## Create

Note: [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]]
Path: knowledge/the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode.md

Summary: Created the REFERENCE note (type: reference, confidence: verified) consolidating the ESP32-S3 Xtensa special-register / EXCCAUSE / core-isa constant data from source lines 120, 128–156. Clean tables: (1) SR numbers — WINDOWBASE 72, WINDOWSTART 73, EPC1 177, EXCSAVE1 209 (with the RM-typo-192/DEPC note + EXCSAVE2..7 210–215 confirmation), INTERRUPT/INTSET 226, INTCLEAR 227, INTENABLE 228, PS 230, VECBASE 231, EXCCAUSE 232, CCOUNT 234, CCOMPARE0..2 240–242; (2) encodings — RSR 0x030000|sr<<8|t<<4, WSR 0x130000|…, RSIL 0x006000|level<<8|t<<4, RFE 0x003000; (3) EXCCAUSE 0–5 (Illegal/Syscall/IFetchError/LoadStoreError/Level1Interrupt/Alloca, flagged as the only codes the source gives); (4) core-isa constants — TIMER0_INTERRUPT 6, INT6_LEVEL 1, USER_VECOFS 0x340, KERNEL_VECOFS 0x300, VECBASE_RESET 0x40000000, NUM_AREGS 64, NUM_TIMERS 3. Reasoning intro: these are fixed silicon/processor-config constants, not derivable, so an emulator must hardcode them. No SR number or code invented — explicitly noted where the source is non-exhaustive (EXCSAVE2..7 range only; EXCCAUSE 0–5 only). Inline-linked all four siblings now in knowledge/: claim-086 (instruction encoding), claim-087 (memory map), claim-072 (CCOUNT/CCOMPARE timer latch), claim-073 (PS.INTLEVEL boot).

## connect

Phase: reflect/connect (run alone, no reweave/verify).

Dual discovery: re-read topic maps knowledge/xtensa.md + knowledge/emulation.md, ls knowledge/ for sibling filenames, and ran qmd_search (no matches — qmd indexes main repo, not this worktree, as the task warned).

MOC membership — already satisfied, no edits needed:
- knowledge/xtensa.md line 40 already lists this note (Exceptions/interrupts/timing section).
- knowledge/emulation.md line 32 already lists this note (Instruction set section).

Outbound link audit (inline body + Relevant Notes both counted). Re-reading caught that concurrent tasks 071/072/073 already added reciprocal links and the note already inline-links them:
- claim-072 (timer latch) — inline line 78 + Relevant Notes. Present.
- claim-071 (zero-cycle vectoring) — inline line 82 (`vectoring costs no cycles`). Present.
- claim-073 (PS.INTLEVEL boot) — inline line 82 + Relevant Notes. Present.
- claim-086 (instruction encoding) — Relevant Notes. Present.
- claim-087 (memory map) — Relevant Notes. Present.

Genuine gap found + closed (1 link, the only real reciprocity debt):
- claim-068 (windowed-register ABI / magic spill-fill) links INBOUND here for `XCHAL_NUM_AREGS = 64` but had no link back. Added a genuine inline link at the `XCHAL_NUM_AREGS` row of the core-isa table (where the relationship is real, not forced) + a Relevant Notes entry. This is now bidirectional.

Deliberately NOT added (per "don't over-link / strongest 2-4"): re-linking 071 (would duplicate the existing inline link — exactly the duplicate the task warned about), and the faithful-emulator umbrella note (the note already cites two of its peers and is at 6 sibling links; the umbrella connection is genuine but not strong enough to justify pushing past the link budget).

Net edit: 1 new outbound link (claim-068), bidirectional reciprocity restored. MOC membership untouched (already correct).

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
