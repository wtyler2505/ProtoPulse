---
description: An ISA emulator's value to downstream co-sim users comes from its explicit cut list, which marks the boundary of where its behavior stops matching silicon
type: claim
audience:
- intermediate
- expert
confidence: verified
created: 2026-06-23
topics:
- emulation
- esp32-s3
- engine-redesign
provenance:
- source: 2026-06-11-esp32s3-emulator-core-verification (batch verification note, @protopulse/emu Esp32s3Core v0)
  verified: 2026-06-23
---
# A faithful instruction-set emulator earns trust by documenting every deliberate cut alongside what it models

When the `@protopulse/emu` Esp32s3Core was verified, every one of its nine slices paired a block of *modeled* behavior with an explicit "Emulator cuts" contract — and that pairing is not bookkeeping, it is the trust mechanism itself. A downstream co-sim consumer cannot reason about whether the emulator's output is meaningful unless it knows where the emulator stops corresponding to real silicon. Therefore the cut list functions as the *fidelity boundary*: inside it, results are trustworthy; outside it, the emulator will either refuse or silently diverge, and the consumer needs to know which.

This is why each cut is stated as a positive contract rather than an apology. The Xtensa core models 24-bit and 16-bit instructions but refuses windowed handler-only ops (L32E/S32E/RFWO/RFWU) and MOVSP outside its magic spill/fill path — refusal is safer than approximation because a wrong answer is worse than a halt. Memory is one 480 KB SRAM window aliased across the IRAM and DRAM buses, with no cache, no SRAM0, single core, and 1 instruction = 1 cycle at 240 MHz; so any consumer measuring cycle-accurate timing or cache effects is outside the boundary and must not trust those numbers. The image loader accepts only SRAM-resident segments and refuses flash-mapped (0x42xxxxxx / 0x3Cxxxxxx) ones because the flash cache is unmodeled, and it [[the-esp-idf-app-image-checksum-is-the-xor-of-all-segment-data-bytes-seeded-with-0xef-stored-as-the-last-byte-of-the-16-aligned-image-body|verifies the XOR checksum but skips the SHA-256 trailer]] — each skip named so a user knows exactly what was and was not checked.

The deeper principle is that a deliberate, documented cut is the opposite of a bug: a bug is an *undocumented* divergence from silicon, whereas a cut is a divergence the author chose and disclosed. Because the verification note carries two independent sources per fact (vendor ESP-IDF headers plus a working disassembler, or the Cadence ISA RM plus ida-xtensa2), each modeled behavior is anchored to ground truth, which is what makes the corresponding cut credible rather than convenient. An emulator that listed only what it models would invite false confidence; pairing each capability with its limit is what lets a co-sim, ERC, or test harness build correctly on top of it.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:

*This is the umbrella claim for the `@protopulse/emu` verification batch; each note below is a single "modeled behavior + its cut" instance of the principle stated here.*

Cuts stated as refusals (the strongest form of the principle — a halt instead of a wrong answer):
- [[an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect-can-refuse-movsp-and-the-handler-only-l32e-s32e-rfwo-rfwu-instructions]] — refusing MOVSP/L32E/S32E/RFWO/RFWU is a cut that is safer than approximating the windowed-handler machinery
- [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]] — the loader refuses flash-mapped segments rather than fake an unmodeled flash cache
- [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]] — the net-effect shortcut is the modeled side whose refused-ops are the paired cut
- [[a-call8-making-xtensa-function-must-entry-with-a-frame-of-at-least-32-bytes-or-its-save-area-overlaps-the-callers]] — the strongest evidence for this principle: the faithfully-modeled spill/fill net effect caught a real ≥32-byte frame-floor ABI violation in a first test draft, exactly the divergence an imprecise emulator would have hidden

Cuts stated as scope/conservatism choices (modeled behavior with a disclosed boundary):
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — zero-cycle vectoring is the cut that drops the pipeline model while staying coherent
- [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]] — booting masked is a deliberate conservative cut that makes the interrupt boundary explicit
- [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]] — clearing timer IRQs only by writing CCOMPARE (not via INTCLEAR) is the modeled behavior whose paired cut is the warning: folding it into a generic INTCLEAR path would be the undocumented divergence — a bug, not a disclosed cut
- [[emulating-only-24-bit-xtensa-core-instructions-is-sufficient-because-the-esp-toolchain-assembler-emits-no-16-bit-code-density-forms]] — skipping 16-bit code-density forms is a cut justified by the toolchain, not an oversight
- [[an-emulator-can-model-sar-adc-oneshot-reads-as-instant-conversions-because-firmware-waits-on-the-start-bit-edge-and-done-flag-not-sar-clock-timing]] — instant conversion is a timing cut that firmware's wait-on-DONE contract makes invisible
- [[the-esp-idf-app-image-checksum-is-the-xor-of-all-segment-data-bytes-seeded-with-0xef-stored-as-the-last-byte-of-the-16-aligned-image-body]] — verifying the XOR checksum while skipping the appended SHA-256 trailer is the disclosed-boundary cut named in this note's body; byte-level integrity is checked, the SHA is not

What makes the modeled side (and therefore each cut) credible:
- [[two-source-verification-resolves-silicon-facts-that-a-single-garbled-vendor-pdf-leaves-ambiguous]] — dual-source anchoring is what turns a cut from "convenient" into "deliberate and grounded"
- [[a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings]] — the stronger oracle behind the modeled-behavior facts
- [[a-shared-mcucore-contract-keeps-peripheral-co-sim-identical-across-cores-with-the-adc-sampler-surviving-reset-as-bench-wiring]] — the contract that consumers build on once they know the fidelity boundary

The same contract-as-trust-boundary pattern elsewhere:
- [[wokwi-chips-use-counterclockwise-pin-ordering]] — another emulation-interop contract where an implicit assumption is a silent bug source if undocumented
- [[writing-plans-must-precede-executing-plans-as-contract]] — the same contract-as-trust-boundary pattern applied to process rather than silicon

Topics:
- [[emulation]]
- [[esp32-s3]]
- [[engine-redesign]]
