---
description: "ESP32-S3 ADC1 channel n = GPIO(n+1); the emulator uses this to route analogRead to the wired bench pin"
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

# ESP32-S3 ADC1 channel N reads GPIO N+1 so an emulator resolves analog reads to the correct bench pin

On the ESP32-S3, SAR ADC1's channel index is offset by one from its GPIO: channel `n` samples `GPIO(n+1)`. Channels 0–9 cover GPIO1–GPIO10, and the second unit, ADC2, continues the run with channels 0–9 mapping to GPIO11–GPIO20. This is not the ESP32-classic layout (where ADC1 sat on GPIO32–39) — the mapping is part-specific and comes straight from `soc/adc_channel.h` in ESP-IDF v5.2, so it cannot be inferred from the original chip.

The off-by-one matters because an emulator and a real bench speak two different coordinate systems. Firmware (and the Arduino `analogRead` wrapper) issues a conversion against a *channel*: the SAR HAL writes the one-hot `1 << channel` into `SAR1_EN_PAD`. But a co-sim sensor — [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread|a potentiometer, a divider]] — is wired to a *physical pin*. If the emulator equated channel number with pin number, a read on ADC1 channel 3 would resolve to GPIO3 instead of the GPIO4 the wire actually lands on, and the sampled value would come from the wrong node. Applying the `+1` translation at the channel→pin boundary keeps the simulated read pointed at the same conductor a bench technician would probe.

This is why the channel map belongs in the emulator core rather than in user code: it is silicon geometry, fixed per part, and the McuCore is the single place that owns the chip's identity. The conversion itself is [[an-emulator-can-model-sar-adc-oneshot-reads-as-instant-conversions-because-firmware-waits-on-the-start-bit-edge-and-done-flag-not-sar-clock-timing|modeled as instant — the core honors the start-bit edge and DONE flag, not SAR clock timing]] — and the sampler that supplies values is [[a-shared-mcucore-contract-keeps-peripheral-co-sim-identical-across-cores-with-the-adc-sampler-surviving-reset-as-bench-wiring|treated as bench wiring that survives reset]], so the mapping is the durable link between a firmware channel index and a stable physical pin.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 241–242)

Relevant Notes:
- [[an-emulator-can-model-sar-adc-oneshot-reads-as-instant-conversions-because-firmware-waits-on-the-start-bit-edge-and-done-flag-not-sar-clock-timing]] — the timing half of the same oneshot read; this note resolves *which pin*, that one resolves *when DONE fires*
- [[a-shared-mcucore-contract-keeps-peripheral-co-sim-identical-across-cores-with-the-adc-sampler-surviving-reset-as-bench-wiring]] — the contract that reads against this channel→GPIO map; reciprocates its inbound link
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]] — the physical analog source on the far end of the bench pin this mapping resolves to
- [[esp32-adc2-unavailable-when-wifi-active]] — the ESP32-classic ADC layout this S3 mapping deliberately diverges from
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — same emulator, same discipline of modeling silicon faithfully while declaring cuts
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] — the other half of turning a channel read into a meaningful voltage

Topics:
- [[esp32-s3]]
- [[emulation]]
