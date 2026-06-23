---
description: Booting PS.INTLEVEL=15 masks every maskable interrupt at reset, forcing firmware to lower it via RSIL — the safe silicon default, not a bug
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
# A conservative emulator boots PS.INTLEVEL at 15 so firmware must lower it via RSIL before interrupts fire

On Xtensa, the PS (Processor State) register gates interrupts through its INTLEVEL field: the core accepts a pending interrupt only when that interrupt's priority level exceeds the current PS.INTLEVEL. Setting PS.INTLEVEL to 15 — the maximum — therefore masks every maskable interrupt, because no interrupt can outrank the ceiling. The slice-4 Esp32s3Core verification fixes the emulator's reset state at exactly this value, and the parenthetical names the reason: it is *conservative*. Reset is the one moment the machine has no idea what its handlers, vector table, or stack look like yet; coming up with interrupts already enabled would invite a spurious vector into uninitialized code. Coming up fully masked guarantees the firmware's reset path runs to completion first.

The consequence for anyone reading emulator traces is that interrupts will appear inert until firmware deliberately opens the gate. The instruction that does so is RSIL (Read and Set Interrupt Level): it writes a new INTLEVEL into PS and returns the previous PS into a register in one atomic step — its [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode|fixed `0x006000 | level<<8 | t<<4` encoding and PS as SR 230]] are among the silicon constants the emulator hardcodes. So early startup code typically issues `RSIL` down to level 0 (or to whatever level the application tolerates) only after VECBASE, the stack, and handler state are valid. If a consumer sees a timer match latch TIMERINT but no vector taken, the explanation is almost always that PS.INTLEVEL is still 15 and no RSIL has lowered it yet — masked is the default, enabled is the choice.

This is one of the emulator's deliberate cuts, paired with its modeled behavior: PS gating via INTLEVEL and EXCM is faithfully reproduced, while the conservative reset value documents the boundary so trace-readers do not mistake correct masking for a missing interrupt.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — once RSIL lowers PS.INTLEVEL, this is how the resulting vector is modeled
- [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]] — a timer can latch TIMERINT while still masked by PS.INTLEVEL=15, with no vector taken
- [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]] — the fixed RSIL encoding, PS as SR 230, and the `reset PS.INTLEVEL = 15` stated cut this note expands on
- [[condition-derived-level-interrupts-cannot-be-cleared-by-intclear-until-the-underlying-condition-clears]] — the other interrupt-gating contract in the same emulator: PS.INTLEVEL masks by priority at boot, level sources resist INTCLEAR by condition
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the conservative reset value is one of the documented cuts this trust principle describes

Topics:
- [[xtensa]]
- [[emulation]]
- [[esp32-s3]]
