---
name: "xtensa"
description: "Map of the Xtensa LX7 facts the @protopulse/emu Esp32s3Core depends on: instruction encoding/decode, the windowed-register ABI modeled as net effect, and exception/interrupt/timer behavior."
type: moc
topics:
  - index
  - engine-redesign
---

# xtensa

Map of content for Xtensa LX7 architecture knowledge, scoped to what the `@protopulse/emu` `Esp32s3Core` (v0, call0 ABI) must decode and model. Sibling of [[emulation]]: this MOC carries the *architecture* facts (how Xtensa works), while [[emulation]] carries the *modeling* decisions (what the emulator chooses to model or cut).

## Core Idea

The emulator targets only the slice of the Xtensa ISA the esp-idf toolchain actually emits — 24-bit core instructions, call0 ABI — and reproduces the windowed-register ABI as a memory net-effect rather than running its exception handlers. Everything below is either a decoded fact (encoding, immediates, special registers) or a modeling decision grounded in those facts.

## Knowledge Notes

### ISA encoding & decode

- [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-uses-a-fixed-op0-t-s-r-op1-op2-field-layout-with-format-specific-immediates-and-a-verified-opcode-constant-table]] — the master decode reference (fields, immediates, opcode constants).
- [[emulating-only-24-bit-xtensa-core-instructions-is-sufficient-because-the-esp-toolchain-assembler-emits-no-16-bit-code-density-forms]] — why the v0 core decodes only 24-bit core forms (scope cut, not approximation).
- [[xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4-while-sequential-flow-advances-pc-by-3]] — branch displacement semantics.
- [[xtensa-l32r-always-addresses-backward-from-a-4-aligned-pc-because-its-16-bit-immediate-is-one-extended]] — L32R one-extension.
- [[xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction]] — load/store vs ADDI immediate treatment.

### Windowed-register ABI

- [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]] — magic spill/fill net-effect design.
- [[an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect-can-refuse-movsp-and-the-handler-only-l32e-s32e-rfwo-rfwu-instructions]] — which instructions that design renders unreachable.
- [[a-call8-making-xtensa-function-must-entry-with-a-frame-of-at-least-32-bytes-or-its-save-area-overlaps-the-callers]] — frame-size hazard the emulator surfaced.

### Exceptions, interrupts & timing

- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]]
- [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]]
- [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]]
- [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]]

## Open Questions

_(populated by /extract)_

---

Topics:
- [[index]]
