---
claim: "the Xtensa windowed-register ABI can be emulated by reproducing the spill and fill handlers net memory effect directly, avoiding the exception machinery entirely"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 068: the xtensa windowed-register abi can be emulated by magic spill-fill that reproduces the handlers net memory effect

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 96-126)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Central architectural simplification (slice 3): the 'MAGIC SPILL/FILL' approach lays out memory exactly as compiled code expects without modeling PS or exception entry.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create
Note: [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]]
Summary: The emulator's MAGIC SPILL/FILL writes the spill/fill handlers' documented net memory layout directly (a0..a3 and a4..a7/a11 stack slots) so compiled code is satisfied without modeling WindowOverflow/Underflow exception entry, PS, or WindowStart rotation; cuts named (zero-cycle spill, refused handler-only ops).

## connect

Phase: reflect/connect (2026-06-23). Dual discovery: topic-map exploration of [[xtensa]] and [[emulation]] (both real MOCs) + on-disk sibling verification in knowledge/ (qmd protopulse-vault indexes the main repo, not this worktree, so vector hits were not trusted).

MOC membership: already present in BOTH [[xtensa]] (under "Windowed-register ABI") and [[emulation]] (under "Windowed-register ABI"). No MOC edits needed.

Inline links ADDED to this note's Relevant Notes (note previously linked only to the faithful-emulator cut-list principle):
- [[an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect-can-refuse-movsp-and-the-handler-only-l32e-s32e-rfwo-rfwu-instructions]] — closest sibling; this net-effect design is the precondition that renders those five ops unreachable. (Reciprocal: that note already backlinks here.)
- [[a-call8-making-xtensa-function-must-entry-with-a-frame-of-at-least-32-bytes-or-its-save-area-overlaps-the-callers]] — the ABI hazard this exact-layout model surfaced; this note's own final paragraph already references the call8 frame bug. NOTE: link is one-directional (windowed → call8); the call8 note's Relevant Notes point only to the faithful-emulator note, so the reciprocal backlink is missing — flagged for /revisit (see Queue Updates).
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — same "model the net architectural effect, skip the machinery" move applied to interrupt/exception entry. (Reciprocal: that note already backlinks here.)
- [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]] — shared-fact link: this note cites `XCHAL_NUM_AREGS = 64`, which is one of the core ISA config constants that sibling note owns. Genuine dependency, stronger than the pure encoding/decode siblings.
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — retained; the umbrella cut-list principle.

Considered and NOT linked (no genuine direct connection): 24-bit-instructions and the master instruction-encoding note (encoding/decode siblings — adjacent in the MOC but not a direct dependency of the windowing net-effect argument), the memory/image-loading and peripheral co-sim claims (different fidelity-boundary axis).

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
