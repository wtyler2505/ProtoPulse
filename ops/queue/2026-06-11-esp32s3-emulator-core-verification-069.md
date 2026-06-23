---
claim: "a call8-making Xtensa function must ENTRY with a frame of at least 32 bytes or its save area overlaps the callers, a bug the emulator surfaced in a first test draft"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 069: a call8-making xtensa function must entry with a frame of at least 32 bytes or its save area overlaps the callers

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 115-119)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Verified-the-hard-way ABI gotcha; the emulator caught a real overlap bug, which is itself evidence the magic-handler model is faithful.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[a-call8-making-xtensa-function-must-entry-with-a-frame-of-at-least-32-bytes-or-its-save-area-overlaps-the-callers]]
Path: knowledge/a-call8-making-xtensa-function-must-entry-with-a-frame-of-at-least-32-bytes-or-its-save-area-overlaps-the-callers.md

Summary: Transformed the ABI gotcha from source lines 115-119 into a connective insight. Explains that `ENTRY a1, imm12` allocates `imm12 << 3` bytes AND rotates the window, but the real constraint is the spill handler's fixed layout: for a call8 (8-register) frame, a4..a7 are written at `[prevSP − 32 .. −20]` (prevSP read from `[frame.sp − 12]`), so the frame must be ≥32 bytes (16 base save + 16 callee-extra) to keep the callee's extra save area from overlapping the caller's base save area. An `ENTRY a1,16` caller hits this overlap. Notes the emulator's magic spill/fill model surfaced the bug in a first test draft, which doubles as evidence the model is faithful. Linked to the sibling "faithful emulator documents its cuts" note.

## connect

Dual discovery: walked both topic maps (knowledge/xtensa.md "Windowed-register ABI" section + knowledge/emulation.md "Windowed-register ABI" section) and read the two closest siblings on disk. Verified all sibling filenames exist in knowledge/ (qmd indexes the main repo, not this worktree, so confirmed via `ls`).

Connections added:
- **→ [[the-xtensa-windowed-register-abi-can-be-emulated-by-reproducing-the-spill-and-fill-handlers-net-memory-effect-directly-avoiding-the-exception-machinery-entirely]]** (claim 068, parent design): genuine and primary. This frame-size hazard is a direct consequence of the spill handler's `[prevSP − 32 .. −20]` write layout that 068's net-effect model reproduces verbatim. Added as an inline body link (at the "modeling the spill handler's documented net effect" sentence) AND in Relevant Notes. 068 already backlinked to 069, so this completes the bidirectional edge.
- **↔ [[an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect-can-refuse-movsp-and-the-handler-only-l32e-s32e-rfwo-rfwu-instructions]]** (claim 070, sibling): genuine. Both 069 and 070 are consequences of the same net-effect spill/fill design — 070 records what the abstraction *removes* (handler-only ops L32E/S32E/RFWO/RFWU/MOVSP become unreachable), 069 records what it still *enforces* (the caller's ≥32-byte frame floor). Added reciprocal links in BOTH notes' Relevant Notes sections.

Already present (left intact):
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] (claim 063, umbrella) — the note shipped with this link in phase done; the overlap catch is a concrete instance of the faithful-emulator argument.

MOC membership: confirmed this note is already listed under the "Windowed-register ABI" heading in BOTH knowledge/xtensa.md and knowledge/emulation.md (added during the done phase). No MOC edits needed.

Not linked (judged not genuine enough): the zero-cycle-vectoring note (modeling-xtensa-exceptions...) shares the "model net effect, skip machinery" meta-move but operates on a different mechanism (exception entry, not register windows); the 068↔vectoring edge already carries that cross-cut, so a direct 069→vectoring link would be redundant.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
