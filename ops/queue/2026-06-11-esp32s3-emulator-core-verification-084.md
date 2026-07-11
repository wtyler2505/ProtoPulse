---
claim: "a working disassembler source is a stronger oracle for opcode constants than an ISA overview PDF whose text extraction garbles encodings"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 084: a working disassembler is a stronger opcode oracle than an isa overview pdf with garbled text extraction

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 8-14,36-44,93-94)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Verification-methodology claim: ida-xtensa2 constants were cross-checked against the PDF and real objdump bytes; the PDF alone was unreliable.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings]]
Path: knowledge/a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings.md

Summary: Verification-methodology claim. A working disassembler's source (`ida-xtensa2` xtensa.py) is a stronger opcode-constant oracle than the Espressif Xtensa ISA-overview PDF, because PDF text extraction flattens bit-field typography (subscripts, alignment, sign-/zero-extension superscripts) — it garbled scaled zero-extended load/store offsets into "sign extend" — whereas disassembler constants must be correct to decode real bytes, an empirical guarantee cross-checked against objdump. Inline-linked claim-085 (two-source verification, by forward slug) and claim-065 (PDF garbles load/store offset extension, existing note). Frontmatter follows the canonical single-string-provenance + reliability schema; topics: verification, emulation.

## connect

Ran /connect --handoff on a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings. Dual discovery: topic maps emulation.md + xtensa.md (discovery surface) AND qmd semantic search.

Discovery:
- Topic-map sweep of knowledge/emulation.md (lists 084 under "Verification method") and knowledge/verification.md (auto-stub, was missing both verification-method notes). Sibling filenames verified via `ls knowledge/` (qmd indexes main repo, not this worktree).
- Semantic search (qmd_search "disassembler oracle opcode constants verification…"): no matches — consistent with the note's recorded "Semantic neighbor: none" and the worktree-not-indexed caveat. Net-new coverage for @protopulse/emu.

Genuine links / reciprocity (all siblings verified bidirectional):
- 084 ↔ 085 (two-source-verification): inbound link in 085's Relevant Notes was BROKEN (pointed to old H1-slug `a-working-disassembler-is-a-stronger-opcode-oracle-…-with-garbled-text-extraction`, no file); fixed to the real slug by the concurrent 085 connect run before I could edit — verified correct now. 084→085 already present inline + Relevant Notes.
- 084 ↔ 086 (opcode-constant table): genuine bidirectional (method ↔ the verified table the method produced). 084→086 added to Relevant Notes (present, line 57); 086→084 present (line 112, added by concurrent 086 run). Both verified.
- 084 ↔ 065 (load/store garble): already bidirectional — 084→065 inline + Relevant Notes; 065→084 in 065's Relevant Notes (line 36). The load/store flatten-to-"sign extend" is this note's motivating garble example.

Topic-map membership:
- emulation.md: 084 already listed (no edit needed).
- verification.md: was auto-stub with empty Knowledge Notes; added both verification-method notes (084 + 085) as a minimal additive edit. Left `auto_generated: true` flag and stub description untouched (the "is this a real MOC" judgment is deferred to a human, out of connect scope).

Guardrails honored: did NOT add 084 to xtensa.md (xtensa was a discovery surface, not a membership target — 084's topics are verification + emulation only). No out-of-set link hunting. Concurrency: verification.md is a contested shared surface seeded from 085; re-read immediately before editing, made additive-only change.

## revisit

Ran /revisit --handoff (BACKWARD pass) on a-working-disassembler-source-is-a-stronger-oracle-for-opcode-constants-than-an-isa-overview-pdf-whose-text-extraction-garbles-encodings. Goal: find OLDER insights + sibling claims that depend on / instantiate THIS oracle-method claim but don't link back, and add inline links FROM them TO 084.

Outcome: **zero new links added.** Every genuine dependent already reciprocates (closed by the forward connect pass). This is the correct result for a backward pass, not a miss — revisit exists to catch *asymmetric* genuine connections, and none remained open.

Sweep (knowledge/, `rg -i 'disassembl|objdump|ida-xtensa|garble|text extraction|opcode constant|oracle'`):
- Verified the 4 genuine dependents are already bidirectional:
  - 065 (load/store zero-extend garble) → 084 present (line 36); 084's motivating garble example.
  - L32R one-extend → 084 present (line 41); the one-extend-vs-sign-extend distinction this oracle settled.
  - 086 (24-bit encoding + opcode-constant table) → 084 present (line 112); the table this oracle verified.
  - 085 (two-source verification, parent generalization) → 084 present (line 30).
- All four also linked FROM 084 in its Relevant Notes — fully symmetric.

Candidates evaluated and REJECTED (no genuine dependency — declined to avoid link inflation):
- **special-register note** (RSR/WSR/RSIL/RFE/EXCCAUSE/core-isa reference, claim ~088): tempting because RSR/WSR encodings *are* opcode constants. Rejected: its own provenance (line 18) names Cadence ISA RM instruction pages + esp-idf core-isa.h as its two sources — a RM+header pair, NOT 084's disassembler-vs-PDF pair. No PDF-garble-corrected-by-disassembler story for these encodings. The pull is type-level ("also opcode constants"), not dependency-level. 084 is not its verification mechanism.
- **branch-targets note (claim ~066):** describes PC-relative extension/base semantics, not opcode-constant verification; its load-bearing link is to the encoding table (086), already present. No 084 dependency.
- **oracle-agent-escalation-is-the-strongest-debugging-path** + **the-debugging-escalation-path-trades-speed-for-depth-across-four-levels:** both about the Claude Code "oracle agent" (dev-infrastructure / claude-code-skills domain) — a homonym of "opcode oracle", entirely unrelated to ISA verification. Cross-domain pun-links, declined. (086's existing link to oracle-agent-escalation is a pre-existing loose pun-link from another pass; out of scope for this backward pass to touch.)

Guardrails honored: only genuine instantiates/depends connections considered; no out-of-set link hunting; consistent rejection of type-level/pun connections. Worktree caveat unchanged — qmd indexes main repo not this worktree, so sweep done via `rg` + `ls knowledge/` against the live worktree files.

## verify
(to be filled by verify phase)
