---
description: Xtensa CCOMPARE timer IRQs deassert only on a CCOMPARE write — not via INTCLEAR — which dictates how an emulator must clear them
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
# Xtensa timer interrupts latch when CCOUNT equals CCOMPARE and clear only when CCOMPARE is rewritten

The Xtensa Timer Interrupt Option ties each timer interrupt to a comparison, not a countdown. CCOUNT free-runs, incrementing every cycle, and the moment CCOUNT equals CCOMPAREn the core asserts TIMERINTn. Crucially, that assertion *latches*: it stays set even as CCOUNT keeps advancing past the match value. There is no edge to miss and no auto-reset — the bit holds until firmware acts.

What makes this a trap for emulator authors is *how* it clears. The obvious-looking path — write the interrupt's bit into INTCLEAR (SR 227) — does **not** clear a timer interrupt. The only way to deassert TIMERINTn is to write CCOMPAREn (SR 240–242) again, which simultaneously schedules the next match point. The Cadence ISA RM states it directly: "timer interrupts are cleared by writing CCOMPARE." So a periodic-tick ISR clears its own interrupt as a side effect of arming the next deadline, typically `WSR CCOMPARE0, (CCOUNT + period)`. INTCLEAR governs software/edge-triggered interrupts; the timer comparators own their own clearing. (The mirror-image case is the [[condition-derived-level-interrupts-cannot-be-cleared-by-intclear-until-the-underlying-condition-clears|level-triggered source]], where INTCLEAR is also a no-op — but because the bit re-derives from live state, not because a comparator owns it.)

The modeling consequence is concrete. The emulator cannot fold timer interrupts into a generic "write INTCLEAR → drop pending bit" path, or firmware will loop forever re-entering the tick handler. Instead the WSR-to-CCOMPAREn handler must recompute the match and drop TIMERINTn there, while leaving CCOUNT==CCOMPARE re-latching on the *next* increment. Conflating the two clearing mechanisms is exactly the kind of undocumented divergence from silicon that turns a "cut" into a bug. The ESP32-S3 maps TIMER0 to interrupt 6 at level 1, so this single comparator is the one timer the v0 core models — and a latched TIMERINT still takes no vector until [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire|RSIL lowers PS.INTLEVEL below 1]].

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[condition-derived-level-interrupts-cannot-be-cleared-by-intclear-until-the-underlying-condition-clears]] — the opposite contract: level sources mirror live state and ignore INTCLEAR until the condition resolves, where this comparator latches a sticky bit cleared only by writing CCOMPARE
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — the latched TIMERINT on the modeled INT6 line is the canonical pending interrupt that then vectors at zero cycles
- [[a-cycle-derived-virtual-timer-avoids-per-cycle-bookkeeping-but-needs-float-safe-modulo-at-the-54-bit-wrap]] — the sibling cycle-derived comparator (TIMG0 T0); both read off the single authoritative cycle clock rather than ticking
- [[a-conservative-emulator-boots-ps-intlevel-at-15-so-firmware-must-lower-it-via-rsil-before-interrupts-fire]] — the gate upstream of this latch: TIMERINT can be set yet take no vector while PS.INTLEVEL=15 masks the level-1 line
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the same verification effort; conflating timer-clear with INTCLEAR would be an undocumented divergence, the opposite of a disclosed cut
- [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]] — sibling slice modeling Xtensa net-effect semantics rather than literal machinery

Topics:
- [[xtensa]]
- [[emulation]]
