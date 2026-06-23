---
description: Cross-checking two independent sources that fail independently turns a lossy vendor PDF's ambiguous silicon facts into settled ones via agreement.
type: claim
confidence: verified
audience: [intermediate]
created: 2026-06-23
topics:
  - verification
  - emulation
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---
# Two-source verification resolves silicon facts that a single garbled vendor PDF leaves ambiguous

A vendor's "authoritative" documentation is only as trustworthy as the channel it reaches you through. The Espressif "Overview of Xtensa ISA" PDF *is* primary-source silicon truth — but its text-extraction layer is lossy, and lossy in ways that silently invert meaning: it flattened the load/store family's *zero-extend-then-scale* offset rule into a bare "sign extend," and it transposed the `MOV.N` pseudocode so the destination read as the wrong register. A single reader trusting that one garbled stream would have built a subtly wrong emulator and not known it.

The discipline that resolves this is **two independent sources per fact**. For the `@protopulse/emu` Esp32s3Core, opcode constants and field decodes were cross-checked between the ISA PDF and pfalcon's `ida-xtensa2` `xtensa.py` — a *working* disassembler — plus real `objdump` byte sequences (e.g. `movi a2, 63` = `22 a0 3f`). The two sources fail in unrelated ways: a PDF text-layer garble and a disassembler bug share no common cause. So when they **agree**, that agreement is strong evidence; when they **disagree**, the conflict itself flags exactly which fact needs adjudication by a third authority (the full Cadence ISA Reference Manual per-instruction pages settled `MOV.N`, `MOVI.N`, and the windowed-register mechanics).

The same pattern hardened the register layer. The SHA/AES/RSA interrupt-matrix MAP offsets had been *extrapolated* by a `4·source` formula — wrong — until read directly from esp-idf's `interrupt_core0_reg.h` against a second header, because the source-number enum has gaps versus the MAP-register layout. Computed-from-a-formula is a single-source guess; two headers carrying the same explicit value is verification.

Independence is the load-bearing property. Two copies of the same garbled PDF prove nothing; a working disassembler and a register header fail for different reasons, so their agreement is what makes a silicon fact safe to encode.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

## Relevant Notes
- [[a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings]] — the disassembler-as-oracle case, a specific instance of this two-source pattern.
- [[xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction]] — the concrete garble this discipline caught.
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the umbrella principle; two-source verification is what makes the *modeled* side of each "modeled behavior + paired cut" pair credible, just as the cut list makes the boundary honest.

## Topics
- verification
- emulation
