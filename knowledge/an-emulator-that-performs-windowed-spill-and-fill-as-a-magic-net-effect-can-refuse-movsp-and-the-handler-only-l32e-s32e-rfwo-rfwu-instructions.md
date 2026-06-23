---
description: Modeling Xtensa spill/fill as a direct net-effect makes the exception-handler-only ops (L32E/S32E/RFWO/RFWU) and MOVSP unreachable, so the emulator can safely refuse them
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
- source: 2026-06-11-esp32s3-emulator-core-verification (slices 3 and 5, Cadence ISA RM windowed-register and MOVSP/Alloca handler pages)
  verified: 2026-06-23
  reliability: high
---
# An emulator that performs windowed spill and fill as a magic net-effect can refuse MOVSP and the handler-only L32E S32E RFWO RFWU instructions

Choosing to model Xtensa register-window spill/fill as a *net memory effect* — writing the stack layout the overflow/underflow handlers would have left, rather than running those handlers — does more than skip the exception machinery. It collapses an entire class of instructions out of the reachable program. `L32E` and `S32E` are window-exception load/store variants, and `RFWO`/`RFWU` are the returns *from* a WindowOverflow/WindowUnderflow handler; the only code that ever executes them is the spill/fill handler itself. When the emulator performs the handler's net effect directly (slice 3), no real exception path is ever entered, so those four instructions are never fetched. `MOVSP` belongs to the same family: it exists only to relocate a frame's base save area when `WindowStart` says a register window is live, and the emulator reproduces that relocation as a net effect too (slice 5). Once the relocation is built in, a guest `MOVSP` is likewise dead code.

That is why the cut is safe rather than lossy. Refusing an instruction is only sound when no correctly compiled program can reach it; the magic spill/fill design *creates* that guarantee for these five ops, so refusal costs no fidelity. This is the inverse of approximation — instead of guessing at behavior outside the model, the model removes the need for the behavior entirely.

The cut therefore sits squarely inside the emulator's documented fidelity boundary: it is a deliberate, disclosed divergence justified by the windowing design, not a silent gap. A co-sim or test harness reading the cut list knows these instructions halt rather than misbehave, and knows *why* — the abstraction that eliminated the exception path also eliminated its callers.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]] — the net-effect windowing design that makes these instructions unreachable
- [[a-call8-making-xtensa-function-must-entry-with-a-frame-of-at-least-32-bytes-or-its-save-area-overlaps-the-callers]] — sibling consequence of the same net-effect design: this note records what the abstraction *removes* (handler-only ops), that one records the frame floor it still *enforces* on callers
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the cut-list-as-trust-boundary principle this refusal lives inside
- [[emulating-only-24-bit-xtensa-core-instructions-is-sufficient-because-the-esp-toolchain-assembler-emits-no-16-bit-code-density-forms]] — a sibling cut sharing the same "refuse rather than approximate" safe-failure logic; both are sound because the input distribution (call0 / net-effect windowing) guarantees the refused forms never appear
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — the same "model the architectural net effect, skip the machinery" move applied to exception/interrupt entry; here that move also eliminates the handler-return instructions

Topics:
- [[xtensa]]
- [[emulation]]
- [[esp32-s3]]
