---
claim: "emulating only 24-bit Xtensa core instructions is sufficient because the ESP toolchain assembler emits no 16-bit code-density forms"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 064: emulating only 24-bit xtensa core instructions suffices because the esp toolchain emits no code-density forms

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 46-48)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Scope-narrowing decision justified by observed toolchain output, not guesswork — slice 2 later added the 16-bit forms for completeness.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create
Note: knowledge/emulating-only-24-bit-xtensa-core-instructions-is-sufficient-because-the-esp-toolchain-assembler-emits-no-16-bit-code-density-forms.md
Summary: A v0 Xtensa LX7 interpreter can decode only 24-bit call0-ABI core instructions (skipping 16-bit density + windowed-ABI forms) because the esp-idf toolchain assembler emits only those forms — a scope cut justified by input distribution, not approximation; slice 2 later added the 16-bit forms.

## connect
Phase complete 2026-06-23 (reflect/connect, --handoff).

Dual discovery:
- **Topic-map exploration** — read [[xtensa]] and [[emulation]] MOCs. The `emulation` MOC was already fully built out by a sibling task and lists claim-064 in its "Instruction set (Xtensa)" section; no edit needed there. The `xtensa` MOC was still an auto-generated stub — promoted it to a real MOC (description, Core Idea, three curated Knowledge Notes sections: ISA encoding & decode, windowed-register ABI, exceptions/interrupts/timing), removed the `auto_generated` flags, added `engine-redesign` parent topic to match its sibling.
- **Semantic search (qmd)** — qmd vector/hybrid search against `protopulse-vault` (743 docs) returned zero matches for every query (vector index appears stale/non-functional in this worktree; index path points at the main worktree's `knowledge/`). Fell back to grep over `knowledge/` to confirm the connection set — same emulator/Xtensa cluster surfaced, no additional genuine links beyond those found via topic maps + sibling-claim reading.

Inline links added to the claim note's Relevant Notes (kept the existing native-usb analogy):
- [[a-faithful-instruction-set-emulator-earns-trust...]] — parent principle (this cut is one of the documented cuts; that note names the 24/16-bit cut explicitly).
- [[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding...]] — its "16-bit forms NOT implemented" addendum is the concrete embodiment of this scope cut; already back-linked to 064.
- [[the-xtensa-windowed-register-abi-can-be-emulated...]] — the windowed-ABI omission that travels together with the 16-bit omission (same call0-only justification, stated in 064's body).
- [[an-emulator-that-performs-windowed-spill-and-fill...can-refuse-movsp...]] — sibling cut, same "refuse rather than approximate" safe-failure logic.

No reweave/verify run (one phase only).

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
