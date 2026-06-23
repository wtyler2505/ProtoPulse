---
claim: "Xtensa branch targets add the sign-extended immediate to PC plus 4 while sequential flow advances PC by 3 because displacement is computed from the next-instruction boundary"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 066: xtensa branch targets add to pc plus 4 while sequential flow advances pc by 3

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 21-23)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Core control-flow semantics an emulator must get exactly right; the +4 vs +3 asymmetry is the classic off-by-one trap.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: `knowledge/xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4-while-sequential-flow-advances-pc-by-3.md`

Summary: Atomic v2-schema claim note explaining the Xtensa PC-increment asymmetry. A taken RRI8/BRI12 branch (and J) targets `PC + sext(imm) + 4`, while not-taken sequential flow advances `PC += 3` (the 24-bit core instruction width). The WHY: branch displacement is anchored to a fixed `PC+4` next-instruction reference point, decoupled from the instruction's actual 3-byte length — so an emulator must keep the two increments as independent constants or it lands every taken branch one byte short. Distinguished from CALL0/L32R, which use 4-byte-aligned arithmetic and cannot reuse the flat +4 rule. Net-new vault coverage for `@protopulse/emu`; topics [[xtensa]], [[emulation]].

## connect

Ran /connect --handoff via dual discovery (topic-map exploration of [[xtensa]] + [[emulation]] MOCs, plus on-disk sibling verification — qmd protopulse-vault indexes the main repo, not this worktree, so vector search would miss worktree-only siblings).

**MOC membership (already satisfied):** note is listed in both `knowledge/xtensa.md` (line 24, "ISA encoding & decode" section) and `knowledge/emulation.md` (line 30, "Instruction set (Xtensa)" section). No MOC edits needed.

**Inline links present (created in done phase, all verified on disk):**
- [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-...]] — master encoding reference (parent)
- [[xtensa-l32r-always-addresses-backward-from-a-4-aligned-pc-...]] — contrasting PC-relative form (one-extend vs sign-extend, 4-aligned vs flat +4)
- [[xtensa-load-store-offsets-are-zero-extended-and-scaled-...]] — third axis of the extension-rule family
- [[emulating-only-24-bit-xtensa-core-instructions-is-sufficient-...]] — the PC+=3 advance IS that 24-bit width
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-...]] — sibling exact-PC-semantics fact

**Link added this phase:**
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the umbrella governing principle of the emulation area (per emulation.md Core Idea); the +4/+3 exactness is a "modeled behavior, no cut allowed" instance of that trust contract. Genuine parent connection that was missing.

**Batch siblings evaluated, NOT linked (no genuine connection):** windowed-ABI notes (call8/movsp/spill-fill), timer/interrupt-condition notes, SAR-ADC/SRAM/flash/image-loading/peripheral-co-sim notes — different subsystems, no instruction-decode relationship beyond what the existing encoding-family links already cover. `two-source-verification` and `working-disassembler-oracle` are method notes already cited in the note's provenance, not body-relevant. Avoided over-linking.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
