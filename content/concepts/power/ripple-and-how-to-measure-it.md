---
slug: ripple-and-how-to-measure-it
title: Ripple and how to measure it
ercCodes: []
---

## What it is

Ripple is the residual AC riding on a nominally DC rail — the leftover sawtooth from a switching converter, rectifier hum, or the wiggle of load steps. Measuring it honestly is a skill of its own, because a sloppy probe setup will happily show you noise your rail doesn't have.

## Why it bites

Both directions bite. The rail reads "5.00V" on the multimeter — which averages everything — while your ADC's last few bits dance, audio hums, and the radio's sensitivity quietly degrades: real ripple, invisible to the tool you used. Then you bring out the scope, clip the six-inch ground lead somewhere convenient, and see huge nanosecond spikes on every rail: mostly fiction. That long ground lead is a loop antenna picking up the converter's switching field, and many an afternoon has been spent filtering a ghost. The rail's ripple and the probe's pickup look alike on screen; only technique separates them.

## The numbers

A ripple spec is only meaningful as peak-to-peak at a stated load and measurement bandwidth — "low ripple" without those three is advertising. Mechanism-wise, a buck's output ripple scales with the inductor's ripple current, split between the capacitor (charge-discharge droop) and its ESR (an instant resistive step); with electrolytics the ESR term typically dominates, which is why swapping in a low-ESR part changes the waveform shape, not just its size. Measurement craft is convention but near-universal: engage the scope's 20MHz bandwidth limit to exclude pickup, AC-couple, and measure with a ground spring at the probe tip — tip-and-barrel across the output capacitor, never the alligator clip.

## See it

In the sim, probe a buck's output capacitor modeled with explicit ESR: the waveform is a sawtooth with a sharp step at each switch transition. Set the ESR near zero and re-run — the step vanishes and a smooth charge-discharge triangle remains. Two mechanisms, one trace.

## Go deeper

Related: [esr-and-why-it-matters](esr-and-why-it-matters), [rms-vs-peak](rms-vs-peak), [buck-topology-intuition](buck-topology-intuition), [local-decoupling](local-decoupling). Curriculum: Track 3 "Power", step 4 — ripple measurement in sim. Canonical reference: scope-vendor application notes on power-rail probing and your converter datasheet's ripple test conditions.
