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

Phase run: reweave / `/revisit --handoff` (BACKWARD pass) on 2026-06-23.

**Result: no-op on edits — the graph is already saturated.** The backward pass
found no genuine missing connection to add. This is a legitimate result, not a
skipped phase, for two reasons documented below.

**Discovery method.** `grep -rl` for the target slug across `knowledge/` +
direct read of the `xtensa` MOC and every Xtensa/emu sibling. qmd vector search
was skipped — consistent with reduce + connect findings, the June-23 net-new
notes are not yet ingested into the vector index, so topic-map + grep carried
discovery.

**Existing genuine backlinks TO this note (5, all confirmed inline / Relevant
Notes references with descriptive context, not bare MOC list entries):**

1. [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-...-verified-opcode-constant-table]]
   — "RRI8 immediate scaling vs ADDI sign-extension" (the parent encoding
   reference's Relevant Notes).
2. [[a-working-disassembler-source-is-a-stronger-oracle-...-garbles-encodings]]
   — this garble is its motivating example.
3. [[xtensa-l32r-always-addresses-backward-...-one-extended]] — the three-way
   immediate-extension contrast (zero / sign / one extend).
4. [[xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4-...]] —
   branch imm sign-extension contrasted with zero-extended load/store offsets.
5. [[two-source-verification-resolves-silicon-facts-that-a-single-garbled-vendor-pdf-leaves-ambiguous]]
   — quotes the exact garble in prose ("flattened the load/store family's
   zero-extend-then-scale offset rule into a bare sign extend").

These are the reciprocals of the connect phase's outbound links (siblings 1–4)
plus the verification-discipline note (5), all wired by the sibling claims'
own connect phases.

**Candidate considered and rejected (no link inflation):**

- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]]
  — the umbrella note. Rejected: it organizes children as "modeled behavior +
  its **cut**" instances plus a "what makes the modeled side credible" set
  (two-source, disassembler-oracle, shared-mcucore). The target is a decode-**
  correctness** fact, not a cut; and its verification angle is already carried
  into the umbrella by the disassembler-oracle child linked there. Fails the
  discriminating test ("does the candidate instantiate or depend on
  zero-extend-and-scale vs sign-extend?") on both axes — not a cut, redundant
  on credibility.
- `emulating-only-24-bit-core-instructions` (scope-cut justification),
  `the-...-special-register-numbers-...` (RSR/WSR/EXCCAUSE territory),
  `modeling-xtensa-exceptions-...` (interrupt vectoring) — none turn on the
  imm8 extension rule. No edits.

**No older notes exist.** Every emu/xtensa/esp32-s3 ISA note in this domain is
`created: 2026-06-23` (same batch). There are no pre-dating insights for the
backward pass to update — "older" here reduces to the sibling claims, which the
connect phases already wired bidirectionally. Backward pass confirms saturation
with zero new edits.

## verify
(to be filled by verify phase)
