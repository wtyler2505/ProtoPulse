---
claim: "an emulator can model SAR-ADC oneshot reads as instant conversions because firmware waits on the start-bit edge and DONE flag, not SAR clock timing"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 079: sar-adc oneshot reads can be modeled as instant because firmware waits on the start edge not the sar clock

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 238-248)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Peripheral timing cut justified by the actual driver flow (set force bits, pulse START low-to-high, poll DONE).

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[an-emulator-can-model-sar-adc-oneshot-reads-as-instant-conversions-because-firmware-waits-on-the-start-bit-edge-and-done-flag-not-sar-clock-timing]]
Path: knowledge/an-emulator-can-model-sar-adc-oneshot-reads-as-instant-conversions-because-firmware-waits-on-the-start-bit-edge-and-done-flag-not-sar-clock-timing.md

Summary: Transformed the closed claim into a ~330-word insight note. Grounded in source lines 238–248: the adc_oneshot_ll_* flow sets the force bits, writes the one-hot channel, pulses MEAS1_START_SAR low→high (0→1 edge starts conversion), polls MEAS1_DONE_SAR, then reads MEAS1_DATA_SAR. Core argument: the DONE flag is firmware's only synchronization handle — it never counts SAR clock cycles — so the start-edge→DONE duration is unobservable and the emulator can set DONE immediately and return the quantized value without being observably wrong (instant conversion = correct, not approximate, inside the modeled boundary). Framed as a deliberate disclosed cut; boundary noted (latency-measuring consumers are outside it). Linked siblings: the cut-list/fidelity-boundary note, the ADC attenuation/range note (the unmodeled axis), and the SRAM-only image-loader note. Claim-078 (channel→GPIO) and claim-083 (sampler-survives-reset bench wiring) knowledge notes do not yet exist (both still pending in create phase), so no links to them per the "link if they exist" rule.

## connect

Phase: connect (run via /connect --handoff, 2026-06-23). Dual discovery — topic maps emulation.md + esp32-s3.md, plus re-read of the closest-sibling cluster (078 channel→GPIO, 083 shared McuCore, 063 faithful-emulator umbrella). qmd skipped (indexes main repo, not this worktree); sibling slugs verified directly via `ls knowledge/` + successful reads.

Links added to target note (target only — no revisit/backward edits to other notes):
1. **→ 083** `a-shared-mcucore-contract-...-bench-wiring` — RECIPROCATED a one-directional inbound link. 083 line 31 already points at this note ("the instant-conversion model the contract carries"); the back-link was missing. Genuine bidirectional: 083 is the co-sim contract that carries this instant-conversion model across cores.
2. **→ 078** `esp32-s3-adc1-channel-n-reads-gpio-n-plus-1-...` — closest ADC-cluster sibling. 078 already describes this claim inline ("honors the start-bit edge and DONE flag, not SAR clock timing") without linking it by slug; relationship was latent. Glossed as the *where* (pin) to this note's *when* (timing).

Existing genuine links retained (063 umbrella, esp32-adc-attenuation range axis, sram-only image-loader sibling). 063 already linked, so cycle-derived-virtual-timer routes through the shared umbrella rather than a forced direct link (weaker coupling: time-advance vs. peripheral-not-consuming-time).

Topic-map membership: SATISFIED — target is in emulation.md line 54 (curated "Peripheral co-sim (ADC, TIMG, cross-core contract)" cluster). esp32-s3.md is an auto-stub whose Knowledge Notes section is empty for every sibling (078/083 not listed either); the cluster convention is emulation.md = working MOC, esp32-s3 = awaiting a dedicated curation pass. NOT half-populated here (would race concurrent tasks). Flagged for curation in handoff.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
