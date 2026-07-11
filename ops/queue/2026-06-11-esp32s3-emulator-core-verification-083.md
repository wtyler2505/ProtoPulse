---
claim: "a cross-platform emulator keeps peripheral co-sim contracts identical across MCU cores by having the ADC sampler survive reset as bench wiring under a shared McuCore contract"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 083: a shared mcucore contract keeps peripheral co-sim identical across cores with the sampler surviving reset as bench wiring

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 227-249)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Architectural-decision: setAdcSampler/drainAdcReads mirror the RP2040 core so bench wiring (the sampler) persists across MCU reset like real hardware.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[a-shared-mcucore-contract-keeps-peripheral-co-sim-identical-across-cores-with-the-adc-sampler-surviving-reset-as-bench-wiring]]
Path: knowledge/a-shared-mcucore-contract-keeps-peripheral-co-sim-identical-across-cores-with-the-adc-sampler-surviving-reset-as-bench-wiring.md

Summary: Created verified claim note. A shared McuCore contract (setAdcSampler/drainAdcReads) makes peripheral co-sim behavior identical across MCU cores; the ADC sampler survives reset because it models bench wiring (the physical sensor-to-pin connection), which is not part of the chip's reset state — mirroring RP2040 core behavior and real hardware. Inline-linked claim-078 (ADC1 channel→GPIO n+1) and claim-079 (oneshot instant conversion). Source lines 227–249.

## connect

Ran /connect --handoff (reflect phase, connect only) on 2026-06-23.

Dual discovery:
- Topic maps: note already a member of `knowledge/emulation.md` (line 56, "Peripheral co-sim" section) — topic-map membership satisfied, NOT orphaned. `engine-redesign.md` and `esp32-s3.md` are auto-stub MOCs; per task constraint "concurrent tasks touch shared MOCs ... confine edits to your note + task file," did NOT edit shared MOCs (that is reweave's job, which this phase must not run). Added `engine-redesign` to this note's own frontmatter topics instead — it is the cross-core, core-agnostic contract and the umbrella parent (077) already carries that topic, so membership flows once a reweave rebuilds the MOC.
- Semantic / filesystem search (qmd indexes main repo, not this worktree — verified sibling filenames via `ls knowledge/`): confirmed all three named siblings exist and already reciprocate inbound links to this note (077 umbrella line 47, 078 channel-map line 30, 079 oneshot line 29).

Links added (all genuine, all own-note edits):
1. **[[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]]** (077) — reciprocates the inbound link 077 already makes ("the contract that consumers build on once they know the fidelity boundary"). This was the one non-reciprocated bidirectional gap.
2. **[[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]]** — the bench-wiring cross-domain link the task explicitly asked for; grounds this note's abstract "bench wiring / jumper wire survives reset" metaphor in a concrete physical analog source. Sibling 078 already uses the same link.

Frontmatter: added `engine-redesign` topic (+ Topics section). esp32-s3 kept (SAR-ADC instance is S3-specific).

Note body already inline-linked 078 + 079 from the create phase; left intact. No reweave, no verify run.

## revisit

Ran /revisit --handoff (reweave / BACKWARD pass) on 2026-06-23. Goal: find OLDER notes + siblings that should reference THIS note but don't, and add inline links FROM them TO this note. Genuine connections only — no link inflation.

Discriminating test applied to each candidate: does the older note *depend on or instantiate* this McuCore-co-sim-contract claim? (Dependency must run candidate → this note; if it runs this note → candidate, the existing forward link already captures it and a backward link would be inflation.)

Candidates evaluated:
- **Three batch siblings (077 umbrella, 078 channel-map, 079 oneshot)** — ALREADY reciprocate inbound links to this note (verified in their bodies: 077 line 53, 078 line 30, 079 line 29). The connect phase closed these. No action.
- **`esp32-s3-timg-divider-field-zero...` (co-sim MOC sibling)** — checked directly. It is about TIMG prescaler-field decode (`0 → 65536`), not the ADC `setAdcSampler`/`drainAdcReads` sampler surface. Does NOT instantiate the sampler contract. No genuine link. Closed the "did I miss a dependent sibling" loop.
- **`a-potentiometer-wired-as-voltage-divider...` (cross-domain bench-wiring note)** — REJECTED as backward link. Dependency runs the wrong way: THIS note uses the pot as its concrete "bench wiring" example (forward link new→pot already exists). The pot is a physical device independent of any emulator; it does not depend on the co-sim contract. A pot→contract link would assert a false dependency (inflation) and drag emu-internals context into a passives/breadboard note (hurts its composability).
- **RP2040 / pico notes** (`rp2040-pio-...`, `pico-...`, `hardware-board-rpi-pico`) — REJECTED. These are physical-silicon/board notes, NOT notes about the `@protopulse/emu` RP2040 *core*. The emu RP2040 core has no knowledge note (batch was ESP32-S3 only). Nothing depends on this contract from those notes.

Result: **zero new backward links** — the correct outcome. The reduce phase already recorded "Semantic neighbor: none ... net-new coverage for @protopulse/emu"; the whole 26-claim batch is net-new, so there are no *older* emulator/co-sim notes that could genuinely depend on this claim. Only contemporaneous siblings (already reciprocated via connect) and older hardware notes (referenced BY this note, not dependent ON it).

Shared MOCs (`engine-redesign.md`, `esp32-s3.md`) NOT edited — concurrent reweave across 26 sibling tasks would collide there, and the backward pass asks for inline links from older insights, not MOC rebuilds. `emulation.md` already lists this note (line 57).

## verify
(to be filled by verify phase)
