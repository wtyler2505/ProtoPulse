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
(to be filled by connect phase)

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
