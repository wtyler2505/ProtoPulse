---
claim: "an emulator that performs windowed spill and fill as a magic net-effect can refuse MOVSP and the handler-only L32E S32E RFWO RFWU instructions"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 070: magic spill-fill lets an emulator refuse movsp and the handler-only windowed instructions

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 122-126,158-167)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Scope cut enabled directly by the magic-handler design decision — refusing handler-only ops is safe because no real exception path exists.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note created: knowledge/an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect-can-refuse-movsp-and-the-handler-only-l32e-s32e-rfwo-rfwu-instructions.md

Summary: Modeling Xtensa spill/fill as a direct net-effect (slice 3) and MOVSP/Alloca relocation as a net-effect (slice 5) makes the handler-only ops L32E/S32E/RFWO/RFWU and MOVSP unreachable in any correctly compiled guest program — the only code that would execute them is the WindowOverflow/Underflow/Alloca handlers, which the emulator never enters. Refusal is therefore sound (no reachable instruction is lost), the inverse of approximation. Linked inline to claim-068 (net-effect windowing, the design that creates the unreachability) and claim-063 (cut-list-as-trust-boundary, the principle the refusal lives inside) — both sibling notes exist in knowledge/.

## connect

Ran /connect --handoff via dual discovery (topic maps knowledge/xtensa.md + knowledge/emulation.md, both real MOCs, plus on-disk sibling verification — qmd protopulse-vault indexes main repo not this worktree, so filenames were confirmed with `ls knowledge/`).

Topic-map membership: already satisfied. The note is listed in both knowledge/xtensa.md (§Windowed-register ABI) and knowledge/emulation.md (§Windowed-register ABI — modeled as net effect; handler ops refused). No MOC edits needed.

Inline links added to the note (it previously linked 068 + 063):
- [[emulating-only-24-bit-xtensa-core-instructions-is-sufficient-because-the-esp-toolchain-assembler-emits-no-16-bit-code-density-forms]] — sibling cut sharing the same "refuse rather than approximate" safe-failure logic. This is RECIPROCAL: that note already links here describing this note in the same terms.
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — same "model the net effect, skip the machinery" move; skipping the exception path is what renders handler-return ops unreachable.

Reciprocal back-link added: the zero-cycle-vectoring note (043) now links back here (it previously did not), making the new edge bidirectional.

Link NOT added (judged not genuine for this specific "refusals" note): the call8 frame-size note (032) is a hazard the net-effect design *surfaced*, not a refusal/cut sibling; the 068 note already bridges to it. Confirmed existing edges (068→here, 24-bit→here) are already bidirectional, so the connect graph for this claim is now complete.

## revisit

Backward pass (/revisit --handoff) for claim-070. Goal: find OLDER siblings that should reference THIS note but don't, and add inline links FROM them TO here.

**Outcome: zero new links added — connect already wired full reciprocity.**

Verified all five of this note's outbound targets already link back here (so the connect phase did its job for this tightly-knit batch):
- 068 windowed-register-abi → links here ("the direct consequence: ... refuse them losslessly") ✓
- 032 call8-frame-floor → links here ("sibling consequence ... records what the abstraction removes") ✓
- 063 faithful-cut-list → links here ("refusing MOVSP/L32E/... is a cut safer than approximating") ✓
- 24-bit-only → links here ("a sibling cut with the same refuse-rather-than-approximate logic") ✓
- 043 zero-cycle-vectoring → links here ("the path's handler-return instructions become unreachable and can be refused losslessly") ✓

Candidate considered and REJECTED (link inflation): the encoding-table note (`...uses-a-fixed-op0-t-s-r-op1-op2-field-layout...`). It says windowed-ABI forms (ENTRY/CALL8/RETW/RETW.N) are "refused," which looks adjacent — but it refuses a DIFFERENT op set under a DIFFERENT rationale (call0-ABI-only, "register windows never rotate," owned by the 24-bit / windowed-register-abi notes), and mentions none of claim-070's five ops (MOVSP/L32E/S32E/RFWO/RFWU). RETW (user-code windowed return) ≠ RFWU (handler-internal return): causally adjacent on silicon, distinct refusal justifications. These are parallel siblings under the 063 cut-list umbrella (both already link 063), not a depends-on/instantiates pair. No link added.

Extra honest sweep: grepped for notes invoking the "lossless cut / refusal is the inverse of approximation / safe-failure" concept beyond the windowed-ops vocabulary. Surfaced only 063, 24-bit, 043, and 068 — all already bidirectionally linked here. The sram-only-loader note (refuses flash-mapped segments) is the same parallel-sibling-under-063 case as the encoding table; no genuine dependency edge.

Topic-map membership unchanged (note already listed in knowledge/emulation.md §Windowed-register ABI and knowledge/xtensa.md). The backward graph for this claim was already complete; ONE PHASE ONLY, no verify run.

## verify
(to be filled by verify phase)
