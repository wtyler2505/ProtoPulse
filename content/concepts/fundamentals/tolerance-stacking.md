---
slug: tolerance-stacking
title: Tolerance stacking
ercCodes: []
---

## What it is

No component is its nominal value: a "10k" resistor at 5% tolerance is anything from 9.5k to 10.5k, and every spec on a datasheet has a similar band. Tolerance stacking is what happens when several of those bands line up against you at once.

## Why it bites

Your prototype works; the third unit you build doesn't. Same schematic, same parts bin — but this time the battery is at the low end of its sag, the resistor came out 5% high, and the LED's forward voltage is at the top of its bin, and the LED barely glows. Worst of all, the failure is intermittent across builds, so you debug the wrong things. Voltage dividers are the classic trap: two 5% resistors give you a divider ratio that can be off by several percent — fine for an LED, fatal for a battery-voltage cutoff threshold.

## The numbers

E24-series resistors are the common 5% family; E96 gives you 1%. Worst-case stacking adds the extremes: a divider built from two 5% parts can have its ratio off by roughly ±5% in the worst corner. Red LED forward voltage spreads about 1.8–2.2V even within one reel — a 0.4V spread that lands directly on your current-setting resistor's drop. The honest design rule: compute the worst-case corners, not the nominal, and make the circuit indifferent across the whole box. Statistical (RSS) stacking is gentler than worst-case, but only valid when you build enough units for statistics to apply — hedge accordingly.

## See it

Take the step-2 LED circuit and sweep the resistor ±5% and the LED forward voltage from 1.8V to 2.2V. Watch the current corner-to-corner: with a healthy resistor drop it barely moves; starve the resistor to 0.3V of drop and the same sweep swings the current wildly.

## Go deeper

Related: [series-vs-parallel](series-vs-parallel), [ohms-law-in-practice](ohms-law-in-practice), [si-prefixes-4k7](si-prefixes-4k7). Curriculum: Track 1 "First Light", step 3 (first-light-03). Canonical reference: Analog Devices' tutorial MT-230 on resistor accuracy, plus any E-series (IEC 60063) table.
