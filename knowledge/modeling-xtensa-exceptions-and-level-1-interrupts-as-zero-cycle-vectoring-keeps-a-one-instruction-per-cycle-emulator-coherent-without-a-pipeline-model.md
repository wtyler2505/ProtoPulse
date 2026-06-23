---
description: Zero-cycle exception/interrupt vectoring is self-consistent under 1-IPC because there is no pipeline to flush; it omits real interrupt latency
type: claim
confidence: verified
audience: [intermediate]
created: 2026-06-23
topics:
  - xtensa
  - emulation
  - esp32-s3
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---
# Modeling Xtensa exceptions and level-1 interrupts as zero-cycle vectoring keeps a one-instruction-per-cycle emulator coherent without a pipeline model

The slice-4 addendum to the Esp32s3Core verification establishes a timing rule — CCOUNT increments every cycle, one instruction equals one cycle at 240 MHz — and then states that exception and level-1 interrupt vectoring "costs no cycles." Those two facts are not in tension; the second follows from the first. The emulator has no pipeline, so there is nothing for vectoring to be coherent *with*. On real Xtensa silicon, taking an exception or interrupt flushes in-flight instructions, refills the fetch pipeline at VECBASE+VECOFS, and burns a handful of cycles before the handler's first instruction retires. That penalty exists only because a pipeline exists. A pure interpreter that retires exactly one instruction per cycle has no in-flight state to discard, so charging zero cycles for the control-flow transfer is the *only* internally consistent choice — any non-zero number would be an invented penalty unmoored from any modeled mechanism.

This is therefore a deliberate cut, not an oversight: the emulator omits real interrupt latency. Code whose correctness depends only on architectural state — registers, PS gating via INTLEVEL and EXCM, the [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten|CCOUNT/CCOMPARE timer-interrupt latch]] — runs faithfully, because vectoring updates EPC1, EXCCAUSE, and PC exactly as the ISA specifies, using the [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode|fixed VECBASE+VECOFS, EXCCAUSE, and RFE constants]] the silicon bakes in. Vectoring is also the downstream half of the boot story: a [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire|core that resets with PS.INTLEVEL=15]] takes no vector at all until RSIL opens the gate, and only then does this zero-cycle transfer fire. What it cannot reproduce is *when* a handler fires relative to a cycle budget: real entry/exit latency, the cost of saving and restoring context, and any timing-sensitive interrupt-response measurement all fall outside the boundary. A consumer benchmarking interrupt response, or firmware that races a timer deadline against handler entry, must treat those numbers as unmodeled.

The simplification composes cleanly with the core's other cuts — only the INT6 timer line exists, level-1 only, no medium/high-priority levels, no WAITI — because all of them share the same premise: model architectural effect, skip microarchitectural cost. The cut is honest precisely because the 1-IPC rule names the abstraction it lives inside.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the general principle; this is one concrete cut from its cut list
- [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]] — the precondition: no vector fires until RSIL lowers PS.INTLEVEL, after which this zero-cycle transfer takes over
- [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]] — the fixed EPC1/EXCCAUSE/VECBASE/VECOFS/RFE constants this vectoring step reads and writes (and where "vectoring costs no cycles" is listed as a stated cut)
- [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]] — the latched TIMERINT on the one modeled INT6 line is the canonical pending interrupt that then vectors at zero cost
- [[condition-derived-level-interrupts-cannot-be-cleared-by-intclear-until-the-underlying-condition-clears]] — the level-triggered counterpart: GPIO/UART sources drive the external level-1 line that vectors here, and stay asserted (re-vectoring each instruction) until the condition clears
- [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]] — the same "model net effect, skip the machinery" move applied to register windows
- [[an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect-can-refuse-movsp-and-the-handler-only-l32e-s32e-rfwo-rfwu-instructions]] — when this move skips an exception path entirely, the path's handler-return instructions become unreachable and can be refused losslessly
- [[xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4-while-sequential-flow-advances-pc-by-3]] — another exact-PC-semantics fact the interpreter must honor while skipping cycle costs

Topics:
- [[xtensa]]
- [[emulation]]
- [[esp32-s3]]
