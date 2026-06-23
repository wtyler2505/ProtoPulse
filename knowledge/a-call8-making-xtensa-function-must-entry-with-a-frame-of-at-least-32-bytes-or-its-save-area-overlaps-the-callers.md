---
description: An ENTRY allocating <32 bytes lets a call8 callee's register save area collide with the caller's frame; the emulator caught this in an early test
type: claim
confidence: verified
audience: [intermediate]
created: 2026-06-23
topics:
  - xtensa
  - emulation
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---
# A call8-making Xtensa function must ENTRY with a frame of at least 32 bytes or its save area overlaps the caller's

On Xtensa's windowed register architecture, `ENTRY a1, imm12` does two things at once: it rotates the register window forward and subtracts `imm12 << 3` from the stack pointer to carve the new frame. That left-shift-by-3 means the immediate is counted in units of 8 bytes, so `ENTRY a1, 16` reserves only 128 bytes — but the byte count is not where the trap lives. The trap lives in the *layout* the window spill handler assumes when it has to flush registers to memory.

When a function issues a `call8`, the architecture's overflow handler may later spill the caller's saved registers using a fixed convention: a0..a3 land just below the next frame's stack pointer, and for an 8-register frame the extra group a4..a7 is written relative to the *previous* frame's SP, fetched from `[frame.sp − 12]`, into the range `[prevSP − 32 .. −20]`. For that extra save area to sit clear of the caller's own 16-byte base save area, the caller's frame must be at least 32 bytes — 16 bytes for the base save plus 16 bytes of callee-extra headroom. Allocate less, and the two regions point at overlapping memory: the callee's spill silently corrupts the caller's saved a0..a3.

This is exactly the bug the `@protopulse/emu` Esp32s3Core surfaced in a first test draft. A test caller used `ENTRY a1, 16`, made a `call8`, and the emulator — modeling the spill handler's documented net effect rather than approximating it (see [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]]) — produced an overlap, exposing an ABI mistake that real silicon would also punish but that an imprecise emulator would have hidden. The fix is a frame floor, not a workaround: any call8-making function ENTRYs with ≥32 bytes. The episode doubles as evidence that the magic spill/fill model is faithful enough to catch real ABI violations.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]] — the parent design: this frame-size hazard is a direct consequence of the spill handler's `[prevSP − 32 .. −20]` layout that the net-effect model reproduces exactly
- [[an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect-can-refuse-movsp-and-the-handler-only-l32e-s32e-rfwo-rfwu-instructions]] — sibling consequence of the same net-effect design; that note records what the abstraction *removes* (handler-only ops), this one records what it still *enforces* (the caller's frame floor)
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the broader trust argument; this overlap catch is a concrete instance of the model being faithful enough to expose a real divergence

Topics:
- [[xtensa]]
- [[emulation]]
