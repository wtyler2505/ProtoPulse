---
description: A tested disassembler's source code is a more reliable opcode-constant oracle than a vendor ISA PDF, whose text extraction garbles bit-field encodings.
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

# A working disassembler source is a stronger oracle for opcode constants than an ISA-overview PDF whose text extraction garbles encodings

When the ESP32-S3 emulator core needed exact Xtensa opcode and mask
constants, two candidate sources were on the table: Espressif's
"Overview of Xtensa ISA" PDF, and `pfalcon/ida-xtensa2`'s `xtensa.py` —
the source of a working disassembler. The disassembler won as the
primary oracle, and the reason is structural rather than incidental.

A PDF is a *rendered* document. Its opcode tables encode meaning in
typography: subscripts mark bit ranges, column alignment binds a field
name to its bit positions, and superscripts distinguish sign-extension
from zero-extension. Text extraction flattens all of that. On these
very pages it collapsed scaled, zero-extended load/store offsets into
the same "sign extend" phrasing used for `ADDI`/`ADDMI` — a silent
corruption that would have produced a subtly wrong emulator. A reader
cannot tell, from the extracted text alone, which encodings survived
the round trip and which were mangled.

A disassembler's source is a *different kind of artifact*: it is
executable, and it has been run against real binaries. Its opcode and
mask constants cannot be approximately right — a wrong mask
mis-decodes known-good instruction bytes, and the disassembler visibly
fails. Correctness is enforced by the tool's own function, so the
constants carry an empirical guarantee the PDF's text never can. In
this case `ida-xtensa2`'s constants were cross-checked against both the
PDF *and* against objdump byte sequences, letting the garbled prose be
overruled by code that demonstrably works.

The general lesson: prefer oracles whose correctness is *load-bearing*
for some working system over oracles that merely describe behavior in a
lossy presentation format. This is a specific instance of
[[two-source-verification-resolves-silicon-facts-that-a-single-garbled-vendor-pdf-leaves-ambiguous]] — the disassembler is precisely the second source that breaks the tie — and it explains the failure mode catalogued in [[xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction]], where the PDF's flattened "sign extend" was the garble in question.

## Source

[[2026-06-11-esp32s3-emulator-core-verification]] (lines 8-14, 36-44, 93-94)

## Relevant Notes

- [[two-source-verification-resolves-silicon-facts-that-a-single-garbled-vendor-pdf-leaves-ambiguous]] — the disassembler is the corroborating second source
- [[xtensa-load-store-offsets-are-zero-extended-and-scaled-while-addi-and-addmi-offsets-are-sign-extended-and-pdf-text-extraction-garbles-this-distinction]] — the concrete encoding the PDF garbled

## Topics

- [[verification]]
- [[emulation]]
