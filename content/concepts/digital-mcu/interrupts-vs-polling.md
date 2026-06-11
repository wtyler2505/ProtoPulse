---
slug: interrupts-vs-polling
title: Interrupts vs polling
ercCodes: []
---

## What it is

Polling checks an input over and over in a loop; an interrupt has the hardware grab the CPU the instant the pin changes. Firmware books treat this as a software design choice — but it's a *hardware* choice too, because the two react completely differently to the noise and bounce of real pins.

## Why it bites

An edge-triggered interrupt is a noise amplifier. It responds to every edge the pin ever sees: every bounce of a switch, every glitch coupled in from a nearby motor wire, every ESD tick — each one a full handler invocation. The classic build: button-on-interrupt works on the bench, then the motor is wired in, and "button presses" start arriving whenever the motor commutates, because the interrupt faithfully counted nanosecond glitches that coupled onto the trace. Polling has the opposite temperament: it only looks at the pin at sample instants, so it naturally ignores glitches between samples — a free low-pass filter — but by the same token it can *miss* a real pulse shorter than the polling period. Neither is "better"; they fail in opposite directions, and the pin's electrical environment should pick the winner as much as the firmware architecture does.

## The numbers

The polling contract is exact: sampling every T guarantees you catch any state that persists longer than T, and guarantees nothing about pulses shorter than T — a 1ms loop cannot lose a 20ms button press, and cannot promise to see a 10µs glitch (often a feature). Edge inputs respond to glitches down to nanoseconds-scale, part-specific; some MCUs offer optional input filters or require a minimum pulse width — the datasheet's external-interrupt section says which. Interrupt latency is typically a handful of cycles plus whatever your firmware blocks; the hard part is rarely the latency, it's the storm.

## See it

In the co-sim, wire a bouncing button to an edge-interrupt counter: one press, a dozen counts. Switch to 1kHz polling that requires three agreeing samples before declaring a change: one press, one count — and watch a deliberately injected 5µs glitch fool the interrupt while the poller never blinks.

## Go deeper

Related: [debouncing](debouncing), [floating-inputs](floating-inputs), [pull-up-pull-down](pull-up-pull-down). Curriculum: Track 2 "Signals & Switches", step 2 — the bounce storm seen from the firmware side. Canonical reference: your MCU datasheet's external-interrupt and input-filter sections.
