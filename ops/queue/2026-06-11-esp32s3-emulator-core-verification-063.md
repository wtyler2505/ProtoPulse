---
claim: "a faithful instruction-set emulator earns trust by documenting every deliberate cut alongside what it models"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 063: a faithful instruction-set emulator earns trust by documenting every deliberate cut alongside what it models

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 6-187)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Every one of the 9 verification slices pairs modeled behavior with an explicit 'Emulator cuts' contract — the cut list IS the trust boundary for downstream co-sim users.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create
Note created: knowledge/a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models.md

Summary: Atomic claim note arguing the Esp32s3Core's per-slice "Emulator cuts" contracts ARE its trust mechanism — the cut list is the fidelity boundary that lets co-sim consumers know where emulator behavior stops matching silicon; a documented cut is the opposite of a bug, and dual-source verification of each modeled behavior is what makes the paired cut credible. v2 schema (type: claim, confidence: verified, topics: emulation/esp32-s3/engine-redesign), provenance to the batch source note verified 2026-06-23, linked to wokwi-pin-ordering and writing-plans-as-contract.

## connect

Ran /connect --handoff on this claim. This note is the **umbrella/meta-claim** for the entire `@protopulse/emu` Esp32s3Core verification batch — every sibling claim is one "modeled behavior + paired cut" instance of the principle it states.

**Dual discovery:**
- Topic-map exploration: the three `topics:` MOCs (`emulation`, `esp32-s3`, `engine-redesign`) plus `xtensa` were all auto-generated stubs from `.claude/hooks/auto-create-parent-moc.sh`. Treated `emulation` as the genuine hub for this batch.
- Semantic search: qmd `protopulse-vault` collection indexes the MAIN repo's `knowledge/` (743 docs), not this worktree, so vector/keyword search returned no hits for the worktree-only emulator notes. Verified the sibling-claim filenames directly on disk instead (all present).

**Inline links added** to the note's Relevant Notes section — curated into three groups so the connections carry meaning, not just adjacency:
- Cuts-as-refusals: refuse-MOVSP/L32E/S32E/RFWO/RFWU, SRAM-only-loader refusing flash-mapped, windowed-ABI net-effect.
- Cuts-as-scope/conservatism: zero-cycle vectoring, boot-INTLEVEL-15, 24-bit-only ISA, instant SAR-ADC conversion.
- Credibility of the modeled side: two-source verification, working-disassembler oracle, shared McuCore contract.
- Kept the two pre-existing cross-domain links (wokwi CCW pin ordering, writing-plans-as-contract).

**MOC updated:** Promoted `knowledge/emulation.md` from auto-stub to a real MOC. Wrote a proper description + Core Idea (this claim) and grouped the full 22-note emulator family under six headings (verification method, instruction set, windowed ABI, exceptions/interrupts/timers, memory/image loading, peripheral co-sim). Removed the `auto_generated` flag and added `engine-redesign` as a parent topic. `xtensa`, `esp32-s3`, `engine-redesign` MOCs remain stubs (out of scope for this single-claim phase; `emulation` now points into them).

ONE PHASE ONLY — did not run reweave or verify.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
