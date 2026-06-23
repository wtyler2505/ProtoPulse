---
claim: "a working disassembler source is a stronger oracle for opcode constants than an ISA overview PDF whose text extraction garbles encodings"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 084: a working disassembler is a stronger opcode oracle than an isa overview pdf with garbled text extraction

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 8-14,36-44,93-94)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Verification-methodology claim: ida-xtensa2 constants were cross-checked against the PDF and real objdump bytes; the PDF alone was unreliable.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings]]
Path: knowledge/a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings.md

Summary: Verification-methodology claim. A working disassembler's source (`ida-xtensa2` xtensa.py) is a stronger opcode-constant oracle than the Espressif Xtensa ISA-overview PDF, because PDF text extraction flattens bit-field typography (subscripts, alignment, sign-/zero-extension superscripts) — it garbled scaled zero-extended load/store offsets into "sign extend" — whereas disassembler constants must be correct to decode real bytes, an empirical guarantee cross-checked against objdump. Inline-linked claim-085 (two-source verification, by forward slug) and claim-065 (PDF garbles load/store offset extension, existing note). Frontmatter follows the canonical single-string-provenance + reliability schema; topics: verification, emulation.

## connect
(to be filled by connect phase)

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
