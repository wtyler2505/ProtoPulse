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
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
