---
slug: boost-topology-intuition
title: Boost topology intuition
ercCodes: []
---

## What it is

A boost converter steps voltage *up*: a switch shorts an inductor across the input to store energy in its magnetic field, then releases, and the inductor stacks that energy on top of the input voltage, through a diode, into the output capacitor. Repeat at high frequency and a 5V source makes a steady 12V rail.

## Why it bites

Two traps, both about what a boost *is* rather than what it does. First: the input current is always bigger than the output current. Boosting 5V to 12V at 1A pulls well over 2.4A from the 5V source once efficiency joins in — and makers who budgeted wiring, connectors, and the upstream supply by the 1A output number watch the source sag, the converter stutter, and the whole rail oscillate in and out of regulation. Second: a boost can't turn off. There is a permanent DC path from input through the inductor and diode to the output, so even with switching disabled the output sits near the input minus a diode drop — and a short on the output is fed directly by your battery, limited by nothing the converter controls. Add the start-up surge of charging the output capacitor through that same path, and "enable" means much less than it seems to.

## The numbers

The textbook ideal, continuous conduction: Vout = Vin / (1 − D), so duty cycle 0.5 doubles the input. Conservation of power gives the input current: Iin ≈ Iout × Vout/Vin ÷ efficiency, with efficiency typically in the 80–90s percent range, part- and operating-point-specific — the datasheet's curves hold the real figure. Practical boosts also have a maximum useful ratio; the formula's promise of infinity at D→1 dies in parasitics.

## See it

In the sim, build the switch-inductor-diode-capacitor boost from 5V to 12V with a 100mA load and put ammeters on both sides: watch the input meter read more than double the output meter. Then stop the switching and note the output resting one diode drop below the input — the path that never closes.

## Go deeper

Related: [buck-topology-intuition](buck-topology-intuition), [inductor-saturation](inductor-saturation), [diode-drop-and-flyback](diode-drop-and-flyback), [power-budgeting](power-budgeting). Curriculum: Track 3 "Power", step 4 — converter modules as black boxes, eyes on both meters. Canonical reference: the boost controller datasheet's application section and efficiency-vs-load curves.
