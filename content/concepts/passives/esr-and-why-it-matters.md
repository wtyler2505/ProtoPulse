---
slug: esr-and-why-it-matters
title: ESR and why it matters
ercCodes: []
---

## What it is

Equivalent series resistance is the small resistor hiding inside every real capacitor, in series with the capacitance you paid for. It sets how fast the cap can actually deliver charge, how much it heats up under ripple current, and sometimes whether your regulator is stable at all.

## Why it bites

Your circuit pulls a sharp gulp of current, and the rail dips harder than the capacitance math says it should — because the first thing the load sees isn't the farads, it's the ESR, and V = I × ESR is an instant step the capacitor can't smooth. In power supplies the bite is thermal: ripple current flowing through ESR is I²R heat *inside* the can, which is why bulk electrolytics near rectifiers and bucks dry out and bulge first. The strangest bite runs backwards: some older LDO regulators were designed expecting their output capacitor to have *some* ESR, and swapping in a "better" low-ESR ceramic makes them oscillate — read the regulator's datasheet before upgrading its capacitor.

## The numbers

The instantaneous sag from a load step is ΔV = I × ESR, exactly — a 1A step through 100mΩ of ESR is 100mV gone before the capacitance even starts discharging. Internal heating is P = I²(rms) × ESR, which is why electrolytic datasheets quote a ripple-current rating: it's a thermal limit, not an electrical one. Orders of magnitude, hedged because they vary by part and frequency: ceramics sit down in the milliohms, good polymer parts in the tens of milliohms, general-purpose aluminum electrolytics from tenths of an ohm upward — and an electrolytic's ESR climbs as it ages and as it gets cold. ESR is also frequency-dependent; datasheets quote it at a stated test frequency for a reason.

## See it

In the sim, put a 100µF capacitor with 1Ω of explicit series resistance across a load that steps from 10mA to 1A, and watch the rail step down by roughly a volt at the edge. Reduce the series resistance to 10mΩ and re-run: same farads, different supply.

## Go deeper

Related: [capacitor-types](capacitor-types), [impedance-vs-resistance](impedance-vs-resistance), [power-and-heat](power-and-heat). Curriculum: Track 3 "Power", step 2 — rail bounce is ESR's stage. Canonical reference: an aluminum-electrolytic datasheet's ESR and ripple-current tables, compared against an MLCC's impedance plot.
