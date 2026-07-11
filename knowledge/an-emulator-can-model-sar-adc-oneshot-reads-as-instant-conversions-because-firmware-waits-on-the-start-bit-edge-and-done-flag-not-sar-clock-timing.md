---
description: ESP32-S3 ADC1 oneshot firmware polls the START edge then the DONE flag, never SAR clock cycles, so an emulator may set DONE immediately
type: claim
confidence: verified
audience: [intermediate]
created: 2026-06-23
topics:
  - esp32-s3
  - emulation
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---
# An emulator can model SAR-ADC oneshot reads as instant conversions because firmware waits on the start-bit edge and DONE flag, not SAR clock timing

The cost of modeling an analog-to-digital converter faithfully usually lives in its conversion timing — how many SAR clock cycles each sample takes. The `@protopulse/emu` Esp32s3Core skips that cost entirely for ADC1 oneshot reads, and the justification is not laziness but the shape of the driver flow itself. What `adc_oneshot_ll_*` (and therefore `analogRead`) actually does against [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses|`SENS_SAR_MEAS1_CTRL2_REG` (the register reference tabulates every field bit named here)]] is: set both `MEAS1_START_FORCE` and `SAR1_EN_PAD_FORCE` for software control, write the one-hot channel select, pulse `MEAS1_START_SAR` low→high so the 0→1 edge launches the conversion, then **poll `MEAS1_DONE_SAR`** and finally read the 12-bit result from `MEAS1_DATA_SAR`.

The firmware's only synchronization handle is that DONE flag. It never counts SAR clock cycles, never reads a cycle counter, and has no other observable that depends on how long the converter physically takes. So from the firmware's vantage point, the duration between the start edge and DONE being set is unobservable — any value, including zero, is indistinguishable. That is exactly the condition under which an emulator can collapse the timing: on observing the START edge it can set `MEAS1_DONE_SAR` in the same step and return the quantized value, and no correct firmware can tell the difference. The result is "instant conversion" with no fidelity loss inside the modeled boundary.

This is a deliberate, disclosed cut rather than a silent divergence — the kind a faithful emulator pairs with its modeled behavior so consumers know where trust ends. The boundary it draws: any consumer that *measures* conversion latency (e.g. budgeting sample throughput from SAR clock dividers) is outside it and must not trust the emulator's timing. Within the firmware-visible contract, though, the start-edge-then-DONE handshake is the whole story, so instant completion is correct, not approximate.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the SAR-timing cut is one entry in that documented fidelity boundary
- [[a-shared-mcucore-contract-keeps-peripheral-co-sim-identical-across-cores-with-the-adc-sampler-surviving-reset-as-bench-wiring]] — the co-sim contract that *carries* this instant-conversion model across cores; the sampler it feeds survives reset like bench wiring
- [[esp32-s3-adc1-channel-n-reads-gpio-n-plus-1-so-an-emulator-resolves-analog-reads-to-the-correct-bench-pin]] — the *where* of the same oneshot read (which physical pin) to this note's *when* (no SAR-clock latency)
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] — the attenuation/range axis the emulator likewise does not model, clamping with a fixed 3.3 V quantization instead
- [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]] — sibling Esp32s3Core cut from the same verification note
- [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses]] — tabulates every `MEAS1_*` field in `SENS_SAR_MEAS1_CTRL2_REG` this oneshot handshake reads and writes

Topics:
- [[esp32-s3]]
- [[emulation]]
