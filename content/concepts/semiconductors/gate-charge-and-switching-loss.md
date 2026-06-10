---
slug: gate-charge-and-switching-loss
title: Gate charge and switching loss
ercCodes: []
---

## What it is

Turning a MOSFET on means physically moving charge — the gate charge, Qg — onto its gate, and the FET passes through its lossy half-on region while that charge flows. Switching loss is the heat generated during those transitions, and it scales with how often you switch, not how much current you carry.

## Why it bites

Your MOSFET runs cool driving the LED strip at full-on, so you add PWM dimming and suddenly it's too hot to touch — at *lower* average power. Nothing about the load changed; what changed is that the FET now crosses its linear region thousands of times per second, and every crossing is a brief pulse of V × I dissipation. The usual root cause is a weak gate driver: a GPIO pin can only source a few milliamps, so it fills a big FET's gate slowly, stretching each transition. This is the `hot-fet-04` failure puzzle in one sentence: gate drive too slow, linear-region dwell. The same physics also loads the driver itself — at high PWM frequencies, gate current alone can exceed what a bare MCU pin should supply.

## The numbers

The estimates are honest and simple. Transition time: t ≈ Qg / Igate — 30nC of gate charge from a pin managing 3mA is about 10µs per edge, glacial by switching standards. Average gate-drive current: I = Qg × fsw — that same 30nC at 100kHz costs 3mA continuously, which is also the heat budget of whatever supplies it. Per-edge dissipation depends on the load waveform; the standard rough cut for a hard-switched resistive-ish load is on the order of ½ × V × I × t per transition, times two edges, times frequency. These are estimation tools, not simulation — but they reliably predict which designs need a real gate driver, and dedicated driver ICs source amps where GPIOs source milliamps, shrinking t a thousandfold.

## See it

In the sim, PWM a load through a FET model with a slow gate ramp and plot FET dissipation: spikes at every edge, growing into a fence as you raise the frequency. Speed up the gate drive and watch the fence collapse to clean, cool edges.

## Go deeper

Related: [mosfet-gate-basics](mosfet-gate-basics), [duty-cycle](duty-cycle), [power-and-heat](power-and-heat). Curriculum: Track 2 "Signals & Switches", step 5, and the `hot-fet-04` failure puzzle. Canonical reference: a power-FET datasheet's gate-charge curve and a gate-driver IC datasheet, read as a pair.
