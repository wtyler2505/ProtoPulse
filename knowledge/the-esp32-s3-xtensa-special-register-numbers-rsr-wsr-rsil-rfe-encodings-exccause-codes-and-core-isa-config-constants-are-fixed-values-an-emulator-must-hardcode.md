---
description: Verified table of ESP32-S3 Xtensa SR numbers, RSR/WSR/RSIL/RFE encodings, EXCCAUSE 0-5, and core-isa constants an emulator hardcodes.
type: reference
confidence: verified
audience: [expert]
created: 2026-06-23
topics:
  - xtensa
  - emulation
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---

# ESP32-S3 Xtensa special-register, RSR/WSR/RSIL/RFE, EXCCAUSE, and core-isa constants reference

These values are **fixed silicon constants**, not derivable at runtime. Special-register numbers, the RSR/WSR/RSIL/RFE opcode bit-patterns, the EXCCAUSE enumeration, and the ESP32-S3 core-isa configuration are baked into the Xtensa LX7 core and the Espressif processor configuration; nothing in firmware or in a running trace lets you compute them. An emulator therefore has no choice but to **hardcode** them — exactly as the silicon and the toolchain headers fix them. The values below come from the Cadence Xtensa ISA Reference Manual (SR table §5.3, EXCCAUSE table, Timer Interrupt Option §4.4.6, RSIL/RSR/WSR/RFE instruction pages) and esp-idf v5.2 `xtensa/config/core-isa.h` for the ESP32-S3 configuration, [[two-source-verification-resolves-silicon-facts-that-a-single-garbled-vendor-pdf-leaves-ambiguous|verified two-source-per-fact]] for the `@protopulse/emu` Esp32s3Core — the same discipline that caught the RM's EXCSAVE1=192 typo by cross-checking the EXCSAVE2..7 range.

## Special-register numbers

| Special register | SR number | Notes |
|---|---|---|
| WINDOWBASE | 72 | windowed-register option |
| WINDOWSTART | 73 | windowed-register option |
| EPC1 | 177 | exception PC for level 1 |
| EXCSAVE1 | 209 | RM index has a typo listing 192 — that is DEPC; EXCSAVE2..7 at 210–215 confirm 209 |
| INTERRUPT | 226 | read side (write side is INTSET) |
| INTSET | 226 | write side of SR 226 |
| INTCLEAR | 227 | |
| INTENABLE | 228 | |
| PS | 230 | processor state |
| VECBASE | 231 | vector base |
| EXCCAUSE | 232 | |
| CCOUNT | 234 | cycle counter |
| CCOMPARE0 | 240 | timer compare 0 |
| CCOMPARE1 | 241 | timer compare 1 |
| CCOMPARE2 | 242 | timer compare 2 |

> EXCSAVE2..7 occupy SR 210–215 (cited as the confirmation that EXCSAVE1 is 209, not 192); the source does not enumerate them individually beyond that range statement.

## Instruction encodings (RSR / WSR / RSIL / RFE)

| Instruction | Encoding | Semantics |
|---|---|---|
| RSR | `0x030000 \| sr<<8 \| t<<4` | read SR into AR[t] |
| WSR | `0x130000 \| sr<<8 \| t<<4` | write AR[t] to SR |
| RSIL | `0x006000 \| level<<8 \| t<<4` | set PS.INTLEVEL ← level; also reads prior PS into AR[t] |
| RFE | `0x003000` | PS.EXCM ← 0; PC ← EPC1 |

## EXCCAUSE codes

| Code | Cause |
|---|---|
| 0 | Illegal |
| 1 | Syscall |
| 2 | IFetchError |
| 3 | LoadStoreError |
| 4 | Level1Interrupt |
| 5 | Alloca |

> The source enumerates EXCCAUSE 0–5 only (the codes the core v0 verification exercised). Higher cause codes exist on real silicon but are not given here — do not assume values the source does not state.

## ESP32-S3 core-isa configuration constants

| Constant | Value | Meaning |
|---|---|---|
| `XCHAL_TIMER0_INTERRUPT` | 6 | core timer 0 is wired to interrupt line INT6 |
| `XCHAL_INT6_LEVEL` | 1 | INT6 (timer 0) is a level-1 interrupt |
| `XCHAL_USER_VECOFS` | 0x340 | user-exception vector offset from VECBASE |
| `XCHAL_KERNEL_VECOFS` | 0x300 | kernel-exception vector offset from VECBASE |
| `XCHAL_VECBASE_RESET_VADDR` | 0x40000000 | VECBASE reset value |
| `XCHAL_NUM_AREGS` | 64 | physical address registers (windowed ARs) — the count the [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely\|magic spill/fill window]] rotates over |
| `XCHAL_NUM_TIMERS` | 3 | CCOMPARE0..2 (three core timers) |

## Timer-counter behavior (companion semantics)

CCOUNT (SR 234) increments every cycle; `CCOUNT == CCOMPARE[i]` latches `TIMERINT[i]` until `CCOMPARE[i]` is written — "timer interrupts are cleared by writing CCOMPARE" (RM). See [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]] for the latch/clear contract. The `INTCLEAR` SR (227) above acknowledges sticky/edge sources, but [[condition-derived-level-interrupts-cannot-be-cleared-by-intclear-until-the-underlying-condition-clears|it is a no-op for the level-triggered GPIO/UART lines]] whose status the emulator derives from live state — those re-assert until the condition resolves.

## Emulator consequences (stated cuts)

The core v0 models only the timer line (INT6); level-1 only (no medium/high-priority levels, no XSR/WAITI); PS gates via INTLEVEL + EXCM, with UM/WOE stored only; reset `PS.INTLEVEL = 15` (conservative — firmware lowers it via RSIL, see [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]]); [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model|vectoring costs no cycles]]; VECBASE alignment is not enforced.

---

**Source:** [[2026-06-11-esp32s3-emulator-core-verification]] (lines 120, 128–156)

**Relevant Notes:**
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — this note's "Emulator consequences (stated cuts)" section (timer line only, level-1 only, UM/WOE stored not enforced, VECBASE alignment not enforced) is the umbrella principle in miniature: each hardcoded constant is paired with the cut it implies
- [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding-uses-a-fixed-op0-t-s-r-op1-op2-field-layout-with-format-specific-immediates-and-a-verified-opcode-constant-table]] — companion instruction-encoding reference (claim-086)
- [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses]] — companion memory-map reference (claim-087)
- [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]] — CCOUNT/CCOMPARE timer latch semantics (claim-072)
- [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]] — PS.INTLEVEL boot gating (claim-073)
- [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]] — consumes the `XCHAL_NUM_AREGS = 64` constant from this table to size the window it rotates (claim-068)

**Topics:** [[xtensa]], [[emulation]]
