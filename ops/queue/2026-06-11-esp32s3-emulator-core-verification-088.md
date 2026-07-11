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

Phase: reweave / backward pass (run alone, no verify).

Method: this note is a CLOSED reference TABLE — the canonical home for the fixed Xtensa SR numbers, RSR/WSR/RSIL/RFE encodings, EXCCAUSE codes, and core-isa constants. Backward pass = find OLDER notes AND siblings that USE those constants but don't point to the table. Searched all of knowledge/ for SR/RSR/WSR/RSIL/RFE/EXCCAUSE/VECBASE/XCHAL/CCOUNT/CCOMPARE/core-isa references and bucketed by `created:` date.

Pre-batch (older) notes: NONE. Every note referencing these constants is in the 2026-06-11 batch (all created 2026-06-23); the only non-batch hits were the two MOCs (xtensa.md, emulation.md), which already list the target. So the backward pass is entirely sibling-reciprocity within the batch.

Inbound-link audit (siblings that already linked here, no action): 086 (instruction encoding), 087 (memory map), 068 (windowed ABI), a-conservative (PS.INTLEVEL boot), modeling-xtensa-exceptions (zero-cycle vectoring), both MOCs. The connect phase + concurrent tasks had handled these.

Genuine backward gaps found + closed (3 inline links, each anchored at a real SR/constant dependency — not Relevant-Notes-only):

1. **two-source-verification → target** (strongest). The target's own intro cites this note as the verification discipline, and the discipline's headline payoff IS this table: cross-checking EXCSAVE2..7 (SR 210–215) caught the RM index's EXCSAVE1=192 typo (192 = DEPC) and settled it at 209. The note listed the load/store garble and disassembler-oracle as instances but omitted the register-layer headline. Added inline at the "register layer" paragraph + Relevant Notes.

2. **timer-latch → target**. Explicitly cites INTCLEAR (SR 227), CCOMPARE0..2 (SR 240–242), CCOUNT (SR 234) — exactly the numbers the table hardcodes. Added inline at the SR-227/240–242 sentence + Relevant Notes.

3. **condition-derived-level-interrupts → target**. Writes about the CPU `INTCLEAR` (SR 227) being a no-op for level sources. It already linked to 087 — but 087 covers the PERIPHERAL `UART_INT_CLR` (offset 0x10), a different register from the CPU INTCLEAR special register; the table is the right home for SR 227. Target forward-links this note at its own INTCLEAR row, so reciprocity is symmetric. Added inline at the "writing `INTCLEAR`" anchor (with explicit "not the peripheral UART_INT_CLR" disambiguation) + Relevant Notes.

Deliberately NOT linked (rule-out, to avoid inflation): a-cycle-derived-virtual-timer (mentions CCOUNT/CCOMPARE only inside a Relevant-Notes pointer to timer-latch — it models the TIMG peripheral comparator, no Xtensa-SR dependency); the windowed-ABI consequence notes (call8 frame, magic-refuse) and the remaining ADC/SRAM/checksum/flash/encoding-immediate batch siblings (no SR / core-isa dependency).

Net: 3 new outbound→target backlinks (each inline + Relevant Notes), all verified to resolve to the existing target file. MOCs untouched (already correct). Sibling reciprocity for the reference table is now complete.

## verify
(to be filled by verify phase)
