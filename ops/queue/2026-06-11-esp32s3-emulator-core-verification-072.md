---
claim: "Xtensa timer interrupts latch when CCOUNT equals CCOMPARE and clear only when CCOMPARE is rewritten"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 072: xtensa timer interrupts latch when ccount equals ccompare and clear only when ccompare is rewritten

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 142-144)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Timer-interrupt semantic quoted verbatim from the RM; an emulator that clears on any write would diverge from silicon.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]]
Path: knowledge/xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten.md

Summary: Transformed the verbatim RM semantic (source lines 142–144: "CCOUNT = CCOMPARE[i] latches TIMERINT[i] until CCOMPARE[i] is written" / RM: "timer interrupts are cleared by writing CCOMPARE") into a connective claim. Body explains the latch-on-match / clear-on-CCOMPARE-write contract, contrasts it with INTCLEAR (SR 227) — which does NOT clear timer IRQs — and draws the emulator consequence: the WSR-to-CCOMPAREn handler must drop TIMERINTn and recompute the match; folding timer clears into a generic INTCLEAR path loops the tick ISR forever. Notes ESP32-S3 TIMER0 = INT6 @ level 1. Linked to the faithful-emulator-cuts note and the windowed-register net-effect note; topics xtensa + emulation.

## connect

Dual discovery: walked both real MOCs (knowledge/xtensa.md, knowledge/emulation.md) + on-disk sibling scan in knowledge/ (qmd protopulse-vault indexes main repo, not this worktree, so verified filenames via ls).

Topic-map membership: already satisfied — note is listed in xtensa.md (Exceptions/interrupts/timing section) AND emulation.md (Exceptions/interrupts/timers section). No MOC edits needed.

Reciprocated one-directional inbound links (siblings pointed AT this note; it did not point back):
- [[condition-derived-level-interrupts-cannot-be-cleared-by-intclear-until-the-underlying-condition-clears]] — linked here as "the edge/latched contrast case." Reciprocated: added Relevant Notes entry + an inline body link (the mirror-image INTCLEAR-no-op case). Genuine: edge-latched vs level-derived clearing are the two halves of the same INTCLEAR contract.
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — linked here as "the canonical pending interrupt that then vectors at zero cost." Reciprocated: added Relevant Notes entry. Genuine: the latched TIMERINT is what subsequently vectors.
- [[a-cycle-derived-virtual-timer-avoids-per-cycle-bookkeeping-but-needs-float-safe-modulo-at-the-54-bit-wrap]] — linked here as "the sibling cycle-based timer." Reciprocated: added Relevant Notes entry. Genuine: both comparators read off the one authoritative cycle clock.
- [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]] — linked here as "a timer can latch TIMERINT while still masked." Reciprocated: added Relevant Notes entry + inline body link at the TIMER0=INT6@level-1 sentence. Genuine: PS.INTLEVEL masking is the gate upstream of this latch taking a vector.

Pre-existing outbound links kept: faithful-emulator-cuts (umbrella), windowed-register net-effect (sibling slice).

Net: note went from 2 outbound links to 6, all reciprocal with verified inbound siblings. No spurious links added (no genuine relationship to the special-register, memory-map, or peripheral notes beyond what the MOC already carries).

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
