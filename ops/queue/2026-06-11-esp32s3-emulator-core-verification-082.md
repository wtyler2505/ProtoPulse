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
(to be filled by connect phase)

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
