---
claim: "modeling Xtensa exceptions and level-1 interrupts as zero-cycle vectoring keeps a one-instruction-per-cycle emulator coherent without a pipeline model"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 071: zero-cycle exception and interrupt vectoring keeps a one-instruction-per-cycle emulator coherent

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 128-156)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Timing simplification (slice 4) consistent with the 1-cycle-per-instruction model; avoids pipeline/latency bookkeeping the emulator does not need.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]]
Path: knowledge/modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model.md

Summary: Created the insight note from source lines 152-156 (slice-4 addendum). Transformed the bare "vectoring costs no cycles" cut into connective reasoning: zero-cycle vectoring is the only internally consistent choice under the 1-IPC model because the emulator has no pipeline, so there is no flush/refill latency to charge — the real-silicon entry/exit penalty exists only because a pipeline exists. Named the omission (real interrupt latency, context save/restore cost, timing-sensitive interrupt-response measurement) as a deliberate cut, and showed it composes with the core's other cuts (INT6-only timer, level-1 only, no WAITI) under the shared "model architectural effect, skip microarchitectural cost" premise. Linked to the parent cut-list principle note, the windowed-register magic-handler sibling, and the branch-target PC-semantics sibling.

## connect

Ran connect/reflect (handoff mode) 2026-06-23.

Dual discovery:
- **Topic maps** — note was already a member of both real MOCs: [[xtensa]] (under "Exceptions, interrupts & timing") and [[emulation]] (under "Exceptions, interrupts, timers"). No MOC edit needed; membership confirmed on disk.
- **Sibling scan on disk** — verified all batch siblings exist in `knowledge/` (qmd indexes the main repo, not this worktree, so checked filenames directly). Read the full interrupt/timer cluster (072 timer-latch, 073 boot-INTLEVEL-15, 082 condition-level-INTCLEAR) plus 088 (special-register reference).

Genuine connections added (inline + Relevant Notes):
- **073 boot-INTLEVEL-15** — completes a reciprocal loop. 073 already linked forward ("once RSIL lowers PS.INTLEVEL, this is how the resulting vector is modeled"); 071 now links back: masking is the precondition, zero-cycle vectoring is the downstream half once the gate opens. Strongest link in the cluster.
- **088 special-registers reference** — 071's vectoring mechanism reads/writes EPC1, EXCCAUSE, VECBASE+VECOFS, and RFE; 088 is the reference that fixes those exact constants AND lists "vectoring costs no cycles" as a stated cut. Added 071→088 inline, and a reciprocal 088→071 backlink on that cut line in 088's "Emulator consequences" section.
- **072 timer-latch** — the latched TIMERINT on the one modeled INT6 line is the canonical pending interrupt that then vectors at zero cost. Linked 071→072 (latch as upstream cause of vectoring); kept one-directional since 072's body is about clearing, not vectoring cost.

Considered but NOT linked: 082 (condition-level-INTCLEAR) — about clearing level-derived sources, a more distant cousin; the vectoring-cost claim has no direct dependency on it. Linking would be filler.

Note: an earlier reweave pass (separate task) had already added the 071→[[an-emulator-that-performs-windowed-spill-and-fill-as-a-magic-net-effect...]] link; left intact.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
