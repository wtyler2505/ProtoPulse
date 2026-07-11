---
name: "emulation"
description: "How the @protopulse/emu Esp32s3Core models an MCU faithfully: every modeled behavior is paired with a documented cut, and the cut list is the fidelity boundary downstream co-sim builds on."
type: moc
topics:
  - index
  - engine-redesign
---

# emulation

Map of content for the instruction-set / register-level emulation work in the engine redesign — specifically the `@protopulse/emu` `Esp32s3Core` (v0) verified against the ESP32-S3 (Xtensa LX7).

## Core Idea

A faithful emulator earns trust not by claiming completeness but by drawing its own boundary. The governing claim of this whole area:

- **[[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]]** — the umbrella principle. Every note below is one "modeled behavior + paired cut" instance of it; the cut list IS the trust mechanism for co-sim, ERC, and test-harness consumers.

## Knowledge Notes

### Verification method (why the modeled facts are credible)
- [[two-source-verification-resolves-silicon-facts-that-a-single-garbled-vendor-pdf-leaves-ambiguous]]
- [[a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings]]

### Instruction set (Xtensa) — see also [[xtensa]]
- [[emulating-only-24-bit-xtensa-core-instructions-is-sufficient-because-the-esp-toolchain-assembler-emits-no-16-bit-code-density-forms]]
- [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-uses-a-fixed-op0-t-s-r-op1-op2-field-layout-with-format-specific-immediates-and-a-verified-opcode-constant-table]]
- [[xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction]]
- [[xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4-while-sequential-flow-advances-pc-by-3]]
- [[xtensa-l32r-always-addresses-backward-from-a-4-aligned-pc-because-its-16-bit-immediate-is-one-extended]]
- [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]]

### Windowed-register ABI (modeled as net effect; handler ops refused)
- [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]]
- [[an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect-can-refuse-movsp-and-the-handler-only-l32e-s32e-rfwo-rfwu-instructions]]
- [[a-call8-making-xtensa-function-must-entry-with-a-frame-of-at-least-32-bytes-or-its-save-area-overlaps-the-callers]]

### Exceptions, interrupts, timers (zero-cycle vectoring; conservative boot)
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]]
- [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]]
- [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]]
- [[condition-derived-level-interrupts-cannot-be-cleared-by-intclear-until-the-underlying-condition-clears]] — level-triggered GPIO/UART sources where INTCLEAR is a no-op until the condition resolves (the contrast to the latched timer)
- [[a-cycle-derived-virtual-timer-avoids-per-cycle-bookkeeping-but-needs-float-safe-modulo-at-the-54-bit-wrap]]

### Memory & image loading (SRAM-only window; flash-mapped refused)
- [[the-esp32-s3-maps-one-sram-block-at-both-an-iram-and-a-dram-address-so-an-emulator-can-model-it-as-a-single-window-aliased-to-two-bus-addresses]]
- [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses]]
- [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]]
- [[the-esp-idf-app-image-checksum-is-the-xor-of-all-segment-data-bytes-seeded-with-0xef-stored-as-the-last-byte-of-the-16-aligned-image-body]]
- [[flash-mapped-irom-and-drom-segments-carry-post-mapping-virtual-addresses-so-an-emulator-serves-them-read-only-straight-from-the-image]]

### Peripheral co-sim (ADC, TIMG, cross-core contract)
- [[esp32-s3-adc1-channel-n-reads-gpio-n-plus-1-so-an-emulator-resolves-analog-reads-to-the-correct-bench-pin]]
- [[an-emulator-can-model-sar-adc-oneshot-reads-as-instant-conversions-because-firmware-waits-on-the-start-bit-edge-and-done-flag-not-sar-clock-timing]]
- [[esp32-s3-timg-divider-field-zero-means-divide-by-65536-because-the-hal-wraps-the-2-to-65536-range]]
- [[a-shared-mcucore-contract-keeps-peripheral-co-sim-identical-across-cores-with-the-adc-sampler-surviving-reset-as-bench-wiring]]

## Open Questions

_(populated by /extract)_

---

Topics:
- [[index]]
- [[engine-redesign]]
