---
slug: bjt-as-a-switch
title: BJT as a switch
ercCodes: []
---

## What it is

A bipolar transistor used as a switch lives at two extremes: fully off (no base current, no collector current) or fully on — *saturated* — where it drops only a small voltage no matter what the load wants. The whole game is base current: enough of it slams the transistor into saturation; too little leaves it half-on, and half-on is where transistors go to overheat.

## Why it bites

"Why is my transistor hot?" is the canonical Track 2 puzzle, and the answer is almost always the same: not enough base drive, so the transistor sits in its linear region, dropping volts while carrying the full load current. Power is V × I — a saturated switch drops almost nothing and stays cool; a half-on one drops, say, half the supply and becomes a heater. The other classic bite is treating the base like a logic input: connect a GPIO straight to the base with no resistor and the base-emitter junction is just a diode to ground — it clamps the pin around 0.7V and the GPIO sources whatever current it can, stressing both parts ([base-resistor-sizing](base-resistor-sizing) is the fix).

## The numbers

Saturation voltage for small BJTs is typically a couple hundred millivolts or less — check the Vce(sat) line, which is quoted at a stated collector *and* base current, and that pairing is the spec talking. The standard switching rule, limit included: don't trust the datasheet's headline current gain (hFE, often 100+) for switching — that's a linear-region number. Drive the base with about a tenth of the collector current ("forced beta of 10"); that's deliberate overkill, and it's what holds the transistor hard in saturation across temperature and part variation. The cost of the overkill is the base current itself, which matters on a power budget but rarely otherwise.

## See it

In the sim, switch a 100mA load with a base resistor sized for 1mA of base current, and read Vce: roughly a volt, with the transistor dissipating ~0.1W. Resize for 10mA of base drive and re-run: Vce collapses to millivolts and the heat almost vanishes. Same parts, one resistor changed.

## Go deeper

Related: [base-resistor-sizing](base-resistor-sizing), [mosfet-gate-basics](mosfet-gate-basics), [push-pull-vs-open-collector](push-pull-vs-open-collector). Curriculum: Track 2 "Signals & Switches", step 4. Canonical reference: a 2N3904-class datasheet's Vce(sat) test conditions, plus Horowitz & Hill on transistor switches.
