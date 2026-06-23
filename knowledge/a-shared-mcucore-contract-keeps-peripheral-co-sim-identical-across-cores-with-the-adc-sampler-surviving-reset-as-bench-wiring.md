---
description: A shared McuCore contract makes peripheral co-sim identical across cores; the ADC sampler survives reset because bench wiring is not chip reset state.
type: claim
confidence: verified
audience: [intermediate]
created: 2026-06-23
topics:
  - emulation
  - esp32-s3
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---

# A shared McuCore contract keeps peripheral co-sim identical across cores with the ADC sampler surviving reset as bench wiring

A cross-platform emulator faces a structural tension: each MCU core (RP2040, ESP32-S3, …) decodes a different ISA, owns a different register map, and exposes peripherals at different addresses — yet the co-simulation harness that wires emulated firmware to virtual sensors must behave *identically* regardless of which core is running underneath. The resolution is a **shared McuCore contract**: a single co-sim surface (here `setAdcSampler` / `drainAdcReads`) that every core implements the same way. Because the contract — not the core — defines the co-sim behavior, swapping the ESP32-S3 core for the RP2040 core changes nothing the harness can observe.

The subtle correctness detail is **reset semantics**. When the McuCore's ADC machinery models a peripheral reset, what gets cleared is the *chip's* state — the conversion registers, done flags, force bits, channel enables. The sampler is deliberately *not* cleared. The sampler represents the **bench wiring**: the physical connection between an external sensor and an ADC pin. On real hardware, asserting RESET on the microcontroller does not unplug the jumper wire from the breadboard — the analog source remains connected. Modeling the sampler as surviving reset therefore mirrors physical reality, and it matches the established RP2040 core behavior, keeping the two cores' contracts byte-for-byte aligned.

This is why the ESP32-S3 SAR ADC1 oneshot path can plug straight into the same harness: the conversion completes instantly (see the oneshot claim) and resolves to the correct bench pin (channel n → GPIO n+1; see the channel-map claim), while the sampler that supplies the reading persists across resets like the wiring it represents. The contract makes the *behavior* portable; treating the sampler as bench wiring makes the *reset model* physically honest.

---

**Source:** [[2026-06-11-esp32s3-emulator-core-verification]] (lines 227–249)

## Relevant Notes

- [[esp32-s3-adc1-channel-n-reads-gpio-n-plus-1-so-an-emulator-resolves-analog-reads-to-the-correct-bench-pin]] — the channel→GPIO map the sampler reads against
- [[an-emulator-can-model-sar-adc-oneshot-reads-as-instant-conversions-because-firmware-waits-on-the-start-bit-edge-and-done-flag-not-sar-clock-timing]] — the instant-conversion model the contract carries

## Topics

- emulation
- esp32-s3
