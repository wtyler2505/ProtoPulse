---
description: For level-triggered GPIO/UART sources the interrupt status is a function of live state, so INTCLEAR is a no-op until the condition resolves.
type: claim
confidence: verified
audience: [intermediate]
created: 2026-06-23
topics:
  - esp32-s3
  - emulation
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---

# Condition-derived level interrupts cannot be cleared by INTCLEAR until the underlying condition clears

When an emulator models level-triggered peripheral interrupt sources, the interrupt status bit is not stored state that firmware can wipe — it is a *derived function* of the live hardware condition. The ESP32-S3 emulator recomputes its two modeled sources (GPIO and UART0) whenever their inputs change and drives the CPU's level-1 external lines through `setExtInt` — the same lines that, once asserted and unmasked, [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model|take a vector at zero cycles]]. Because those lines are level-triggered, writing `INTCLEAR` (the Xtensa interrupt-clear path) has no lasting effect while the condition still holds: the source re-evaluates and immediately re-asserts the line — and on the next instruction it re-vectors.

The two concrete cases the emulator implements show why. UART `RXFIFO_FULL` asserts once the RX FIFO crosses `RXFIFO_FULL_THRHD`; writing `UART_INT_CLR` (offset 0x10, bit 0) clears nothing durable unless the FIFO is actually drained below threshold. Likewise, GPIO sources configured for `low level` (INT_TYPE 4) or `high level` (INT_TYPE 5) keep their `GPIO_STATUS` bit set as long as the pin holds that level — re-evaluation happens on pin/config/W1TC activity, and clearing the status bit does nothing while the pin level persists. To genuinely silence the interrupt, firmware must resolve the *condition*: drain the FIFO, or change the pin level (or reconfigure the trigger type).

This is the opposite contract from edge-latched sources. The Xtensa timer interrupt *latches* when CCOUNT equals CCOMPARE and stays asserted until CCOMPARE is rewritten — see [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]]. Edge sources hold a sticky bit you clear by acknowledging; level sources hold a mirror of reality you can only clear by changing reality. An emulator that conflates the two will let firmware "clear" a level interrupt that the hardware would keep re-raising, producing a divergence that real silicon never shows. Faithfully reproducing this no-op-clear behavior is part of [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]].

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

## Relevant Notes
- [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]] — the edge/latched contrast case
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — the asserted level-1 line this note drives via `setExtInt` is what then vectors at zero cycles
- [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]] — interrupt-enable preconditions in the same emulator
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — why modeling this behavior (and its cuts) matters

## Topics
- [[esp32-s3]]
- [[emulation]]
