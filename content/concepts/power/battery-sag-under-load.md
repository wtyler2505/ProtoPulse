---
slug: battery-sag-under-load
title: Battery sag under load
ercCodes: []
---

## What it is

Every battery has internal resistance, so the voltage at its terminals drops while current flows and recovers when it stops. The open-circuit voltage is the chemistry's promise; the loaded voltage is what your circuit actually receives — and the gap between them grows with current, age, and cold.

## Why it bites

You measure the battery with a meter: 4.1V, practically full. You reconnect it, the motor starts, and the board resets — because under the motor's starting current the terminal voltage dove far below what the unloaded meter showed, and your regulator fell out of headroom. The bug is invisible at the bench because the bench measurement *is* the unloaded case. Cold weather makes the same hardware fail in winter only: internal resistance rises as temperature falls. And voltage-based fuel gauges lie twice — the displayed "battery percent" jumps up when the load stops and crashes when it starts, so users report a battery that's "fine" right up until the click of a relay kills it. Pulse loads — radio bursts, motor starts — turn the sag into spikes the average never shows.

## The numbers

The simple model is exact as far as it goes: V_loaded = V_oc − I × R_internal. The catch is R_internal, which depends on chemistry, state of charge, age, and temperature — order of magnitude, hedged: small lithium cells run tens to hundreds of milliohms; alkaline AAs start around a few tenths of an ohm and climb steeply as they deplete, which is why "nearly dead" alkalines still read 1.4V unloaded. Pull an amp through half an ohm and your "4.1V" pack delivers 3.6V; the datasheet's discharge curves at multiple loads and temperatures are the honest version of this article.

## See it

Track 5 plots this live: PWM ramps the motor's duty cycle while the co-sim graphs motor current and battery terminal voltage together — current stairs up, voltage stairs down, and the brownout threshold draws closer with every step.

## Go deeper

Related: [brownout-and-por](brownout-and-por), [power-budgeting](power-budgeting), [esr-and-why-it-matters](esr-and-why-it-matters), [voltage-vs-current](voltage-vs-current). Curriculum: Track 5 "Moving Things", step 4 — motor current and battery sag on one plot. Canonical reference: the cell datasheet's discharge curves at several loads and temperatures.
