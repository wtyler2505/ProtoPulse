---
slug: absolute-maximum-ratings-are-not-targets
title: Absolute maximum ratings are not targets
ercCodes: []
---

## What it is

The absolute maximum ratings table marks where *damage begins*, not where operation is allowed. The table you design against is the other one — recommended operating conditions — and the gap between them is the manufacturer's safety margin, which they are not offering to you.

## Why it bites

The bite has a signature rhythm: works on the bench, works in testing, dies in the field weeks later. A part run at its absolute maximum isn't guaranteed to fail instantly — it's merely *not guaranteed to work*, and what you usually buy is accelerated wear: thinned gate oxide, electromigration, a junction running hot enough to age in months instead of decades. The classic reasoning error sounds responsible: "the pin's abs max is 5.5V, my rail is 5V, so I have half a volt of margin." But abs max applies to every instant, not the average — and your 5V rail wears inrush overshoot, switching spikes, ESD events, and the inductive flick of every unclamped relay. The transients your meter never shows are exactly what [ripple-and-how-to-measure-it](ripple-and-how-to-measure-it) teaches you to go look for. A related myth gets its own article: [5v-tolerance-myths](5v-tolerance-myths).

## The numbers

Read the table's footnotes — abs max figures are specified under exact conditions (duration, temperature, one-pin-at-a-time) that rarely match your circuit. Design discipline, common practice rather than law: stay inside recommended operating conditions always, and derate stress-bearing parts further — running voltage and power at no more than ~80% of rating is a widely used engineering habit, stricter for electrolytics and anything hot. For ratings that interact (voltage × current × temperature), the curves in the datasheet body override the headline number: a transistor's full rated current and full rated voltage are almost never available *simultaneously*. [reading-a-datasheet](reading-a-datasheet) covers the method; this article is the table that punishes skipping it.

## See it

In the sim, drive an inductive load with a transistor and no flyback diode: the part flags its Vce abs max exceeded on the spike your average-reading meter would never show — Track 5 kills a virtual transistor this exact way, on purpose.

## Go deeper

Related: [reading-a-datasheet](reading-a-datasheet), [5v-tolerance-myths](5v-tolerance-myths), [diode-drop-and-flyback](diode-drop-and-flyback), [resistor-power-sizing](resistor-power-sizing), [power-and-heat](power-and-heat). Curriculum: Track 5 "Moving Things", step 2 — the flyback lesson is an abs-max lesson. Canonical reference: the "Absolute Maximum Ratings" boilerplate note in any datasheet — read the disclaimer under the table once, carefully.
