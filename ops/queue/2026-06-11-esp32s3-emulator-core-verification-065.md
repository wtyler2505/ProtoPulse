---
claim: "Xtensa load and store offsets are zero-extended and scaled while ADDI and ADDMI offsets are sign-extended, and PDF text extraction garbles this distinction"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 065: xtensa load-store offsets are zero-extended and scaled while addi-addmi are sign-extended

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 29-32)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: A subtle, verification-breaking gotcha: the Espressif overview PDF flattens scaled zero-extend to 'sign extend'; the RM and real encodings disagree.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction]]
Path: knowledge/xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction.md

Summary: Atomic claim note created (v2 vault schema matching existing knowledge/ notes: description ≤140-ish, type/audience/confidence/created/topics/provenance). Captures the RRI8 imm8 decode split — load/store (L32I/S32I imm8<<2, L16UI/S16I imm8<<1, L8UI/S8I imm8) zero-extend then scale (forward-only, non-negative); ADDI sign-extends (±127), ADDMI sign-extends + <<8 (±32 KiB). The verification gotcha: Espressif "Overview of Xtensa ISA" PDF text extraction flattens the scaled zero-extend into "sign extend", so the lossy PDF text layer disagrees with the RM and real encodings — cross-check against ida-xtensa2's xtensa.py disassembler. Net-new instruction-set coverage for @protopulse/emu; no semantic neighbors existed (qmd returned none).

## connect

Phase run: reflect / `/connect --handoff` on 2026-06-23.

**Dual discovery.** Topic-map exploration via the `xtensa` MOC (now a fully
curated MOC, no longer the auto-stub from the create phase) + direct read of
every Xtensa/emu sibling note. qmd `qmd_vector_search` returned no matches for
the immediate-extension / PDF-garble queries — the vector index has not
ingested these June-23 net-new notes, consistent with the reduce note's
"semantic neighbor: none" finding. Topic-map exploration carried the discovery.

**Outbound links added to the target note** (4 genuine connections, all to
sibling claims from this batch, all reciprocated):

1. [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-...-verified-opcode-constant-table]]
   — parent encoding reference; this note is the precise decode of one of its
   format-specific immediate classes (RRI8 `imm8`).
2. [[a-working-disassembler-source-is-a-stronger-oracle-...-garbles-encodings]]
   — generalizes the verification lesson; THIS garble (load/store zero-extend
   flattened to "sign extend") is that note's motivating example.
3. [[xtensa-l32r-always-addresses-backward-...-one-extended]] — the third
   immediate-extension scheme (one-extend); shared "conflating extension rules
   is the classic decoder bug" theme.
4. [[xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4-...]] —
   branch `imm8`/`imm12` are sign-extended like ADDI/ADDMI, contrasting the
   zero-extended load/store offsets.

**Reciprocity:** all four siblings already backlinked to this note (wired by
their own connect phases — claims 066–069). Adding the outbound links closed
the loop both directions; no one-way links remain.

**MOC update:** none needed — the `xtensa` MOC already lists this note under
its "ISA encoding & decode" section with a description ("load/store vs ADDI
immediate treatment"). Verified placement; MOC frontmatter already promoted
(auto_generated flag cleared, Core Idea written).

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
