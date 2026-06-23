---
description: Emulating Xtensa register windows by writing the spill/fill memory layout directly skips the WindowOverflow/Underflow exception path while preserving ABI-visible state
type: claim
confidence: verified
audience:
- intermediate
- expert
created: 2026-06-23
topics:
- xtensa
- emulation
- esp32-s3
provenance:
- source: 2026-06-11-esp32s3-emulator-core-verification (slice 3 addendum, Cadence ISA RM §4.7.1 Windowed Register Option)
  verified: 2026-06-23
  reliability: high
---
# The Xtensa windowed-register ABI can be emulated by reproducing the spill and fill handlers' net memory effect directly, avoiding the exception machinery entirely

On real Xtensa silicon, the Windowed Register Option rotates a small visible window over 64 physical address registers (`XCHAL_NUM_AREGS = 64` on the ESP32-S3), and when a `CALLn`/`ENTRY` or `RETW` needs registers that overlap a live frame, the hardware raises a `WindowOverflow`/`WindowUnderflow` exception whose handler spills or fills register frames to the stack. The `@protopulse/emu` core (slice 3) does **not** model that machinery. Instead it performs what the verification note calls **MAGIC SPILL/FILL**: it writes exactly the memory layout the spill/fill handlers would have left behind, so compiled code reading those stack slots sees what it expects.

This works *because* the ABI contract lives entirely in memory, not in the exception path. The Cadence ISA RM quotes the handlers' net effect verbatim: `a0..a3` land at `[nextFrame.sp − 16 .. −4]`, and for 8/12-register frames the previous stack pointer is read from `[frame.sp − 12]` so that `a4..a7` (or `a4..a11`) land at `[prevSP − 32(−48) .. −20]`. The crt0 startup must pre-initialize the initial frame's `[sp − 12]` "as if it had been written by a window overflow." Therefore an emulator that reproduces *that table of writes* is observationally equivalent to one that runs the real handlers — the exception entry, `PS.CALLINC` bookkeeping, and `WindowStart` rotation are intermediate state the next instruction never reads.

The honesty of this shortcut depends on naming its cuts. Spill/fill is free (zero cycles), `PS` is not modeled at all, and the handler-only opcodes `L32E`/`S32E`/`RFWO`/`RFWU` plus `MOVSP` outside the magic path *refuse* rather than approximate. The note also records the ABI hazard this approach surfaced empirically: a `call8`-making function must `ENTRY` with a frame ≥ 32 bytes, because a smaller save area overlaps the caller's base save area — a bug the emulator caught in a first test draft.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect-can-refuse-movsp-and-the-handler-only-l32e-s32e-rfwo-rfwu-instructions]] — the direct consequence: performing the handlers' net effect makes `L32E`/`S32E`/`RFWO`/`RFWU` and `MOVSP` unreachable, so the emulator can refuse them losslessly
- [[a-call8-making-xtensa-function-must-entry-with-a-frame-of-at-least-32-bytes-or-its-save-area-overlaps-the-callers]] — the ABI hazard this net-effect model surfaced empirically; modeling the spill layout exactly (not approximately) is what let the emulator catch a too-small `ENTRY` frame
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — the same "model the architectural net effect, skip the machinery" move applied to exception/interrupt entry instead of register windows
- [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]] — supplies the `XCHAL_NUM_AREGS = 64` config constant this note depends on to define how many physical address registers the window rotates over
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the cut list that makes this windowed-register shortcut credible rather than convenient

Topics:
- [[xtensa]]
- [[emulation]]
- [[esp32-s3]]
