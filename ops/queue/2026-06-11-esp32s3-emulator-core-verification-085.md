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

Dual discovery: topic maps `knowledge/emulation.md` + `knowledge/verification.md` (re-read live in worktree, since qmd indexes the main repo not this worktree) plus sibling-filename verification via `ls knowledge/`.

Outbound links added/fixed in the note's Relevant Notes:
1. **Fixed a stale link** — the note pointed at `a-working-disassembler-is-a-stronger-opcode-oracle-than-an-isa-overview-pdf-with-garbled-text-extraction` (does NOT exist). Corrected to the real filename `a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings` (claim-084, the closest twin — disassembler-as-oracle is a specific instance of this two-source pattern).
2. **Kept** the link to `xtensa-load-store-offsets-...-pdf-text-extraction-garbles-this-distinction` (claim-065, the concrete garble this discipline caught) — target exists, link resolves.
3. **Added** link to `a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models` (claim-063 umbrella) — per task framing, 063 groups both verification-method notes under "credibility of the modeled side"; two-source verification is what makes the modeled half of each modeled+cut pair credible.

Reciprocity (inbound links verified, no action needed — already present from concurrent tasks):
- claim-084 already links here (twice: body + Relevant Notes) — reciprocated.
- claim-063 (faithful-emulator umbrella) already links here ("dual-source anchoring is what turns a cut from convenient into deliberate") — now reciprocated by edit #3.

Topic-map membership:
- `knowledge/emulation.md` already lists this note under "### Verification method (why the modeled facts are credible)" alongside claim-084 — membership satisfied, no edit needed.
- `knowledge/verification.md` is an auto-generated stub seeded *from this very note* (`auto_generated_source` = this slug); the note's `topics: [verification, emulation]` frontmatter is what created it. Left as-is (auto-stub awaiting human Core Ideas; not the connect phase's job to populate).

No reweave / no verify (single-phase task).

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
