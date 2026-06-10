---
slug: ohms-law-in-practice
title: Ohm's law in practice
ercCodes: []
---

## What it is

Ohm's law, V = I × R, ties the push, the flow, and the resistance into one triangle: know two, get the third. In practice you almost always use it backwards — you know the voltage you have and the current you want, and you solve for the resistor.

## Why it bites

The classic failure is skipping the subtraction. A builder computes 5V ÷ 10mA = 500Ω for an LED resistor, forgets the LED itself eats ~2V, and lands at 6mA wondering why the LED is dim — or worse, computes against the wrong voltage rail entirely and cooks the part. The second failure is applying the law to things that aren't resistors: an LED is not ohmic, so "measuring its resistance" with a multimeter tells you nothing useful about its behavior in-circuit.

## The numbers

The working recipe for any LED: R = (V_supply − V_forward) ÷ I_target. For 5V, a red LED (~2.0V) and 10mA, that's 300Ω — snap to the nearest standard value (330Ω) and accept ~9mA. Ohm's law is exact for ideal resistors; real resistors hold it well within their tolerance band (commonly 5% or 1%) and their power rating. It does *not* hold for diodes, LEDs, or anything with a junction — for those, treat the part as a fixed voltage drop and let the resistor obey the law.

## See it

Build battery → resistor → LED in series. Sweep the resistor from 100Ω to 4.7kΩ and plot current: you'll see the near-perfect 1/R curve, offset by the LED's roughly constant drop. Then sweep the supply from 3V to 9V at fixed R and watch current rise linearly — the law, live.

## Go deeper

Related: [voltage-vs-current](voltage-vs-current), [si-prefixes-4k7](si-prefixes-4k7), [tolerance-stacking](tolerance-stacking). Curriculum: Track 1 "First Light", step 2 (first-light-02). Canonical reference: Horowitz & Hill, *The Art of Electronics*, §1.2.
