---
slug: non-inverting-and-inverting-amps
title: Non-inverting and inverting amplifiers
ercCodes: []
---

## What it is

The two canonical op-amp stages: the non-inverting amp takes the signal at the + input and has gain 1 + Rf/Rg; the inverting amp injects the signal through a resistor into the − input (a virtual ground) and has gain −Rf/Rin. Same chip, opposite personalities.

## Why it bites

The trap is input impedance. The non-inverting amp's input is the op-amp pin itself — nearly infinite, loads nothing. The inverting amp's input impedance is simply Rin, because the far end sits at virtual ground — so hang an inverting stage with a 10k Rin off a sensor or divider and you've loaded it like a 10k resistor to ground, and the "gain of −10" stage delivers some other gain entirely, set partly by a source impedance you forgot — see [voltage-divider-output-impedance](voltage-divider-output-impedance). Second bite: on a single supply, the inverting amp's output wants to go *below* ground for a positive input — it can't, so it sits at zero looking dead until you bias the + input to mid-rail. Third: the non-inverting topology cannot attenuate; its minimum gain is 1, and forcing it lower with tricks usually buys instability.

## The numbers

Gain formulas are exact under the golden rules: 1 + Rf/Rg and −Rf/Rin — see [op-amp-golden-rules](op-amp-golden-rules) for when those rules quit. Resistor scale is a compromise, common practice rather than law: the few-kΩ to ~100kΩ window. Lower wastes output current into the feedback network; higher turns input bias current into offset and the node into an antenna. Gain accuracy is set by resistor tolerance, so two 1% resistors give roughly ±2% worst-case gain — [tolerance-stacking](tolerance-stacking) applies to feedback networks too. And gain costs bandwidth: gain-bandwidth product divided by your noise gain is the flat band you actually get.

## See it

In the sim, drive both topologies from the same 10kΩ-output divider: the non-inverting stage reports the divider faithfully; the inverting stage drags the divider down and reports a gain that matches neither label. Stiffen the source and watch the inverting stage come back to spec.

## Go deeper

Related: [op-amp-golden-rules](op-amp-golden-rules), [voltage-divider-output-impedance](voltage-divider-output-impedance), [shunt-current-sensing](shunt-current-sensing), [tolerance-stacking](tolerance-stacking). Curriculum: Track 7 "Build the Probe" — the front-end gain stages. Canonical reference: any introductory op-amp applications handbook chapter on the two basic configurations.
