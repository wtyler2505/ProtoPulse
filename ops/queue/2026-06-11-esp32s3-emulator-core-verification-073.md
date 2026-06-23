---
claim: "a conservative emulator boots PS.INTLEVEL at 15 so firmware must explicitly lower it via RSIL before interrupts can fire"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 073: a conservative emulator boots ps-intlevel at 15 so firmware must lower it via rsil before interrupts fire

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 152-156)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Reset-state decision matching the safe silicon default; documents why interrupts appear masked until firmware runs RSIL.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]]
Path: knowledge/a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire.md

Summary: Transformed source lines 152-156 ("reset PS.INTLEVEL = 15 (conservative — firmware lowers via RSIL)") into an insight note. Explains that PS.INTLEVEL gates interrupts by priority; setting it to 15 masks all maskable interrupts at reset (safe silicon default, since handler/vector/stack state is uninitialized); firmware lowers it atomically via RSIL once startup is valid; trace-readers should expect interrupts inert until RSIL fires. Framed as a documented emulator cut (PS gating modeled faithfully). Inline-linked both siblings (zero-cycle vectoring claim-071, timer latch claim-072) plus the trust-via-documented-cuts note. Topics: xtensa, emulation, esp32-s3 (matching sibling conventions).

## connect

Ran /connect --handoff (reflect/connect phase only). Verified sibling filenames on disk via `ls knowledge/` (qmd indexes main repo, not this worktree).

**Dual discovery:**
- Topic maps (real MOCs): both [[xtensa]] (Exceptions, interrupts & timing section) and [[emulation]] (Exceptions, interrupts, timers section) ALREADY list this note — membership confirmed, no MOC edit needed.
- Semantic/sibling scan: read all 4 closest interrupt/emulator siblings on disk.

**Reciprocal links found pointing AT this note (already existed before connect):**
- [[modeling-...zero-cycle-vectoring]] links here (downstream of RSIL gate) — note already linked back. Bidirectional. ✓
- [[the-esp32-s3-xtensa-special-register-numbers...]] links here ("PS.INTLEVEL boot gating, claim-073") — note did NOT link back. **Reciprocated.**
- [[condition-derived-level-interrupts...]] links here ("interrupt-enable preconditions in the same emulator") — note did NOT link back. **Reciprocated.**

**Edits made to this note (this note's side only):**
1. Body inline link → special-register reference at the RSIL sentence (fixed `0x006000` encoding + PS as SR 230 are hardcoded silicon constants). Genuine: the note's whole premise rests on RSIL/PS encoding documented there.
2. Relevant Notes → added special-register reference (RSIL encoding + reset PS.INTLEVEL=15 stated cut).
3. Relevant Notes → added condition-derived-level-interrupts (sibling interrupt-gating contract in the same emulator: priority-mask-at-boot vs condition-resists-INTCLEAR).

Pre-existing genuine links retained: zero-cycle-vectoring, timer-latch, faithful-cuts. No spurious links added.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
