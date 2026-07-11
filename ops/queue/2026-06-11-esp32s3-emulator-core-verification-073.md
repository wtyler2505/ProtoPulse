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

Ran /revisit --handoff (BACKWARD pass only — find OLDER notes / siblings that should reference THIS note but don't, add links FROM them TO this note).

**No genuinely older notes exist.** The entire xtensa/emulation cluster (all `created: 2026-06-23`) is net-new coverage for `@protopulse/emu` — the reduce note already established this (qmd vector search returned no pre-existing instruction-set/register-level emulator notes). The backward pass's "find older insights" half is legitimately empty, not an unfinished search.

**All four genuine siblings already link TO the target** (confirmed via `grep -l` over knowledge/): timer-latch (claim-072, inline + Relevant Notes), special-register reference (inline §Emulator consequences + Relevant Notes), zero-cycle-vectoring (claim-071, inline + Relevant Notes), faithful-cuts umbrella. The forward/connect pass established these bidirectional links; nothing to add there.

**One backward sharpen made** — `condition-derived-level-interrupts-cannot-be-cleared-by-intclear...`:
1. Inline link anchored at the existing "once asserted and unmasked" clause — that phrase literally names the PS.INTLEVEL gate this target documents (a level source can hold its line asserted yet take no vector while masked). Genuine precondition dependency, not a reach. Now reads "unmasked by an RSIL lowering PS.INTLEVEL below 1".
2. Upgraded its vague Relevant Notes description ("interrupt-enable preconditions in the same emulator") to name the mechanism, bringing it to parity with the timer-latch sibling's "the gate upstream of this latch" phrasing.

**Rejected as link inflation:** the cycle-derived virtual-timer (TIMG0) note — its claim is about counter *precision* at the 54-bit wrap, not interrupt gating; it raises no interrupt in scope. The other 13 non-linking cluster notes (memory map, image loading, ADC, instruction encoding, verification method) carry no dependency on the PS.INTLEVEL boot gate. None linked.

Net result: a backward pass that finds little because the forward pass was thorough. One generic sibling reference sharpened to inline parity; no spurious links.

## verify
(to be filled by verify phase)
