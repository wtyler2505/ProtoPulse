---
slug: filtering-before-the-adc
title: Filtering before the ADC
ercCodes: []
---

## What it is

An RC low-pass between the signal and the ADC pin does two jobs at once: it removes noise and out-of-band content *before* sampling — the only place it can be removed — and its capacitor doubles as the charge reservoir the converter's sample cap wants. One resistor, one capacitor, two diseases prevented.

## Why it bites

Skip the filter and the failure is statistical, which makes it slippery. Each individual sample is a true snapshot of an ugly signal — PWM hash, switcher ripple, mains pickup riding on your slow sensor — so single readings jump around while the long average looks plausible. Firmware grows compensating folklore: median-of-five, throw-away-outliers, "the sensor needs warming up." Worse, any noise component faster than half your sample rate doesn't average out at all — it *folds down* into a slow, convincing wander that no software filter can remove, because after sampling it is indistinguishable from signal. That mechanism gets its own article: [aliasing](aliasing). The third bite is subtle: filtering with a big series resistor and *no* capacitor at the pin trades noise for settling error, because now the source impedance is too high for the sample cap — see [source-impedance-and-sample-caps](source-impedance-and-sample-caps).

## The numbers

Corner frequency is fc = 1/(2πRC) — the same math as [rc-time-constants](rc-time-constants). Set it above the fastest signal you care about and as far as practical below both the noise and half the sample rate; a decade of separation each way is comfortable when you can get it. Keep R modest — units of kΩ, inside your ADC's source-impedance budget — and let C do the heavy lifting; 100nF-class at the pin is the common pattern, hedged because your signal bandwidth rules. Remember the filter delays the signal by roughly one time constant; a control loop sampling a heavily filtered input is reacting to the past.

## See it

In the sim, ride a 50mV switching-hash ripple on a slow ramp and sample it: raw codes scatter and wander. Insert 1kΩ + 100nF and re-run — the scatter collapses, and the ramp emerges as it always was.

## Go deeper

Related: [aliasing](aliasing), [source-impedance-and-sample-caps](source-impedance-and-sample-caps), [rc-time-constants](rc-time-constants), [ripple-and-how-to-measure-it](ripple-and-how-to-measure-it), [adc-reference-quality](adc-reference-quality). Curriculum: Track 7 "Build the Probe" — every front-end channel filters before it samples. Canonical reference: any "driving SAR ADC inputs" application note.
