---
slug: source-impedance-and-sample-caps
title: Source impedance and sample caps
ercCodes: []
---

## What it is

A SAR ADC samples by briefly switching a small internal capacitor onto your pin and letting it charge toward the input voltage. Whatever drives the pin must fill that capacitor within the acquisition window — and a high-impedance source simply can't, so the ADC converts a half-charged guess.

## Why it bites

The signature failure: you scale a 12V rail down with a sensible-sounding 100kΩ+33kΩ divider, and the reading comes back low — consistently, mysteriously, and by an amount no resistor tolerance explains. Worse, the error changes with sample rate and with *which channel was read before this one*, because the sample cap arrives still holding the previous channel's voltage. That's the multiplexed-ADC crosstalk bug: channel B's reading depends on channel A's signal, and the board behaves differently the moment you reorder the scan list in firmware. Nothing is broken; the source is just too slow to charge the cap, and your divider's output impedance is the reason — see [voltage-divider-output-impedance](voltage-divider-output-impedance).

## The numbers

Settling is plain RC: charging to within ½ LSB of an n-bit converter takes about (n+1)×ln2 ≈ 0.7×(n+1) time constants — roughly 9 time constants for 12 bits — where R is your source impedance plus the ADC's internal switch resistance, and C is the sample cap (commonly a few picofarads to tens of picofarads; datasheet). That's why MCU datasheets publish a maximum recommended source impedance, often in the ~10kΩ region — a number to look up, never assume. Two standard fixes: re-proportion the divider lower (burning more standing current), or park a capacitor of 100nF-class on the pin — a charge reservoir thousands of times larger than the sample cap, which refills it instantly and lets the divider top the reservoir up at leisure. The reservoir trick only works for signals slow compared to the RC it forms.

## See it

In the sim, feed one ADC channel from a stiff source and the next from a 100kΩ divider, then scan them alternately: the weak channel reads pulled toward its neighbor. Add the 100nF reservoir and the reading snaps true.

## Go deeper

Related: [voltage-divider-output-impedance](voltage-divider-output-impedance), [rc-time-constants](rc-time-constants), [adc-reference-quality](adc-reference-quality), [impedance-vs-resistance](impedance-vs-resistance), [filtering-before-the-adc](filtering-before-the-adc). Curriculum: Track 7 "Build the Probe" — front-end scaling feeds the S3's ADC. Canonical reference: your MCU datasheet's ADC input model and maximum source impedance specification.
