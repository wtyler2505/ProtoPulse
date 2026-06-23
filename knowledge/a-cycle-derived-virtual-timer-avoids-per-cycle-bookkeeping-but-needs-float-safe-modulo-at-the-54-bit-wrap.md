---
description: Deriving a timer's value lazily from CPU cycles skips per-cycle ticking, but the 54-bit wrap exceeds JS safe-integer range and needs BigInt or float-safe modulo
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
# A cycle-derived virtual timer avoids per-cycle bookkeeping but needs float-safe modulo at the 54-bit wrap

An emulator never has to *tick* a hardware timer. The ESP32-S3 TIMG0 T0 counter is virtual: its current value is computed on demand as a function of elapsed CPU cycles, so the emulator stores only a cycle baseline and derives the count when firmware reads it or when the alarm comparator runs. This is the same economy the core already buys by retiring one instruction per cycle — there is a single authoritative cycle clock, and every cycle-rate device reads off it lazily instead of maintaining its own per-cycle update. Per-cycle bookkeeping (incrementing a 54-bit register inside the hot fetch-execute loop) would dominate the interpreter's cost for a value most instructions never observe.

The lazy derivation hides a precision hazard. JavaScript Numbers are IEEE-754 doubles, exact only up to 2^53; the TIMG counter is 54 bits. Past 2^53 the unit-in-the-last-place is no longer 1 — at 2^54 the ulp is 4, so consecutive representable integers jump by four and small arithmetic results silently round. The wrap arithmetic is exactly where this bites: a textbook positive-modulo `(x % M + M) % M` computed in `Number` can round an intermediate to a wrong multiple. In the verification slice a first draft did precisely this, rounding 2 to 0, and the error was caught only by test. The fix is float-safe modulo — keep the wrap math inside the safe range, or do the whole counter in BigInt where 54 bits are exact. The lesson generalizes to any cycle-derived register wider than 53 bits in a JS host: lazy evaluation is free, but the wrap is not, and it must be proven by test rather than assumed.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — the one-instruction-per-cycle clock this virtual timer derives its value from
- [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-and-clear-only-when-ccompare-is-rewritten]] — the sibling cycle-based timer (CCOUNT/CCOMPARE) whose comparator the same emulator latches
- [[esp32-s3-timg-divider-field-zero-means-divide-by-65536-because-the-hal-wraps-the-2-to-65536-range]] — the prescaler decode on this very same virtual TIMG0 counter; that note scales the cycle-derived value, this one bounds the precision of the derivation at the 54-bit wrap
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the umbrella principle; lazy cycle-derivation with a test-proven wrap is one modeled behavior whose precision boundary is disclosed rather than assumed

Topics:
- [[esp32-s3]]
- [[emulation]]
