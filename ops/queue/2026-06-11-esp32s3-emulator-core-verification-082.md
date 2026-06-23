---
claim: "level-triggered GPIO and UART interrupt status that an emulator derives from conditions cannot be cleared by INTCLEAR until the underlying condition clears"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 082: condition-derived level interrupts cannot be cleared by intclear until the underlying condition clears

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 189-225)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Slice 6 semantic: RXFIFO_FULL and level GPIO status re-evaluate from state, so INT_CLR has no lasting effect unless the FIFO drains or the pin changes.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create
Note: knowledge/condition-derived-level-interrupts-cannot-be-cleared-by-intclear-until-the-underlying-condition-clears.md

Summary: Created verified claim note explaining that for level-triggered GPIO/UART0 sources the ESP32-S3 emulator derives interrupt status from live state (recomputed via setExtInt on the level-1 external lines), so INTCLEAR is a no-op while the condition holds — the source re-asserts. Concrete cases: UART RXFIFO_FULL (clear only by draining FIFO below RXFIFO_FULL_THRHD) and GPIO low/high-level INT_TYPE (clear only by changing pin level). Contrasted with the edge-latched Xtensa timer (CCOUNT==CCOMPARE, cleared by rewriting CCOMPARE). Inline links to the timer-latch contrast note, the PS.INTLEVEL boot note, and the faithful-emulator-cuts note.

## connect

Dual discovery: topic maps `knowledge/xtensa.md` + `knowledge/emulation.md` (the interrupt cluster — 071 vectoring, 072 timer-latch, 073 boot-INTLEVEL) AND `qmd_search` (returned no matches; qmd indexes the main repo, not this worktree, and this is net-new @protopulse/emu coverage, as the reduce note recorded). Sibling filenames verified via `ls knowledge/`.

MOC membership (was absent from BOTH MOCs — Discovery-First gap, now fixed):
- Added to `knowledge/xtensa.md` "Exceptions, interrupts & timing" cluster, placed beside 072 as the mirror-image level-triggered contract.
- Added to `knowledge/emulation.md` "Exceptions, interrupts, timers" cluster, beside 072.
- Re-read both MOCs immediately before editing (concurrent-task safety); one surgical line-add each.

Outbound links added to the target note:
- 071 zero-cycle vectoring — genuine: the level-1 external lines this note drives via `setExtInt` are exactly the lines 071 vectors at zero cycles. Added inline (at the `setExtInt` sentence) + Relevant Notes entry.
- Pre-existing genuine inline links retained: 072 timer-latch (edge/latched contrast), 073 boot PS.INTLEVEL, faithful-emulator-cuts umbrella.

Reciprocity (verified via `rg -l`): inbound from 072 (timer-latch) and 073 (boot-INTLEVEL) only. Target already reciprocates both (072 + 073 in Relevant Notes) — complete. Inbound backlinks INTO siblings were NOT touched (that is reweave's job; this is connect-only). The memory-map note pointer was considered but not added — weaker than the cluster links and did not read naturally.

Edits confined to: target note + xtensa.md MOC + emulation.md MOC + this task file. No other sibling note bodies modified. No reweave, no verify.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
