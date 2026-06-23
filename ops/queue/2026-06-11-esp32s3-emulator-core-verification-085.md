---
claim: "two-source verification resolves silicon facts that a single garbled vendor PDF leaves ambiguous"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 085: two-source verification resolves silicon facts a single garbled vendor pdf leaves ambiguous

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 1-5,74-78,96-99)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: TENSION: vendor PDF (authoritative but lossy text extraction) vs third-party disassembler (working code but unofficial). Resolved by requiring two independent sources per fact — the doc's stated discipline.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[two-source-verification-resolves-silicon-facts-that-a-single-garbled-vendor-pdf-leaves-ambiguous]]
Path: knowledge/two-source-verification-resolves-silicon-facts-that-a-single-garbled-vendor-pdf-leaves-ambiguous.md

Summary: Methodology claim note created (canonical v2 schema: single-string provenance source + verified + reliability:high). Argues that cross-checking two *independent* sources resolves silicon facts a lossy vendor PDF leaves ambiguous — the load-bearing property is independence: two sources that fail for unrelated reasons make agreement strong evidence and disagreement a flag for third-source adjudication. Concrete examples transformed from the source note: the Espressif "Overview of Xtensa ISA" PDF text-layer flattening zero-extend-then-scale to "sign extend" and transposing MOV.N's dest, caught by cross-checking ida-xtensa2's xtensa.py disassembler + real objdump bytes (movi a2,63 = 22 a0 3f), with the Cadence ISA RM as third-source adjudicator; and the SHA/AES/RSA interrupt-matrix MAP offsets that were wrongly extrapolated by a 4·source formula until read directly from esp-idf interrupt_core0_reg.h against a second header. Inline links: claim-084 (disassembler-as-oracle, a specific instance) and claim-065 (the concrete PDF garble caught). Note that claim-084's knowledge/ note has not yet landed (its create phase is pending) — the wiki-link is a forward link that resolves once 084 is created; claim-065's target exists.

## connect
(to be filled by connect phase)

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
