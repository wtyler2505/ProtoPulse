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

BACKWARD pass (/revisit --handoff). Goal: find OLDER sibling claims that genuinely instantiate/depend on 082 but don't link to it, and add inline links FROM them TO 082.

Inbound baseline (rg -l before this pass): 071 (vectoring), 072 (timer-latch), 073 (boot-INTLEVEL), plus both MOCs (xtensa.md, emulation.md). The connect phase already established 072→082 and 073→082; 071 also already carries a Relevant-Notes link to 082. So the cluster siblings were covered — this pass targeted the verification-batch siblings that share 082's exact shape but were missed.

Three genuine backward links added (advisor-confirmed; INTCLEAR-coverage check ran on 088):

1. **Umbrella note** `a-faithful-instruction-set-emulator-earns-trust-...` — its Relevant Notes section IS the per-slice "modeled behavior + cut" enumeration and already lists the rest of the interrupt cluster (071/072/073), yet omitted 082 even though 082 links *to* it and claims membership. Added a list entry directly beneath the 072 timer-latch line in the "Cuts stated as scope/conservatism choices" group, framing 082 as the mirror-image (level-derived status vs. sticky/edge). Categorized-list form matches the surrounding entries (no forced inline prose).

2. **Memory-map reference** `the-esp32-s3-memory-map-and-peripheral-register-set-spans-...` (claim-087) — defines the exact registers 082's claim operates on (UART `INT_CLR` 0x10, `RXFIFO_FULL_THRHD` CONF1, GPIO `STATUS`/`STATUS_W1TC`, `INT_TYPE` 4/5, level-1 line enumeration) and already carries *behavioral-read* backlinks to the two ADC notes — but not to 082, which is the behavioral read of its UART/GPIO interrupt rows. Added an INLINE link at the GPIO `INT_TYPE` sentence (line 61), parallel to the note's existing inline ADC channel→pin link (line 88). Direction note: connect rejected 082→memory-map (outbound, weak); this is memory-map→082 (inbound behavioral-read) — a different, genuine direction.

3. **Special-register reference** `the-esp32-s3-xtensa-special-register-numbers-...` (claim-088) — defines `INTCLEAR` (SR 227), the exact register 082 names, and its body already contrasts INTCLEAR with the timer-latch clear path (line 78, links 072) and notes level-1-only modeling. 082 is the level-triggered counterpart of that contrast. Added an INLINE link to the CCOUNT/CCOMPARE/INTCLEAR sentence: INTCLEAR acknowledges sticky/edge sources but is a no-op for the level GPIO/UART lines.

Rejected (link-inflation guard): the broad `uart|gpio|int_clr|level` grep returned ~200 physical-hardware notes (esp32-gpio34-39, uart-dominates-wireless, etc.) — those describe real silicon/wiring, not the emulator's interrupt model, so correctly excluded.

Edits confined to: 3 sibling note bodies (umbrella, memory-map 087, special-register 088) + this task file. No forward links added to 082, no MOC edits (connect already placed it in both MOCs), no verify run.

## verify
(to be filled by verify phase)

## verify
(to be filled by verify phase)
