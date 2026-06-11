---
slug: linear-regulator-dropout
title: Linear regulator dropout
ercCodes: []
---

## What it is

A linear regulator makes a clean low voltage from a higher one by burning the difference as heat. Dropout is the minimum input-to-output headroom it needs to keep regulating — starve it of that margin and it stops being a regulator and becomes a slightly lossy wire.

## Why it bites

The classic build: a 3.3V LDO fed from a single lithium cell. Fresh off the charger it works beautifully. A few hours later the cell sags toward 3.5V, headroom evaporates, and your "3.3V" rail quietly becomes the battery voltage minus a few hundred millivolts, drifting downward all day. The symptom is maddening: the board runs fine on the bench supply and gets flaky on battery, with resets that track the battery gauge. The older generation of this bite is the 7805 fed from a 6V pack — those classic parts need a couple of volts of headroom, so that rail never actually regulated at all. And the headroom you keep is also power you burn: a linear regulator from 12V down to 3.3V turns most of your energy into heat, on purpose.

## The numbers

Dissipation is exact arithmetic: P = (Vin − Vout) × Iload. From 12V to 3.3V at 300mA that's about 2.6W — a small package will not survive that without serious copper or a heatsink, and efficiency is Vout/Vin, roughly 28%, before quiescent current. Dropout itself is part-specific: classic NPN-pass regulators need on the order of 1.5–2V of headroom, modern LDOs typically tens to a few hundred millivolts — and dropout rises with load current and temperature, so the real number lives in the datasheet's dropout-vs-current curve, not in the headline on page one. Budget headroom against your worst-case minimum input, never the nominal one.

## See it

In the sim, feed a 3.3V LDO model from a source you sweep from 6V down to 3V at a fixed load. The output sits flat — then follows the input down the moment headroom shrinks below dropout. Plot the pass element's dissipation along the sweep and watch where the watts go.

## Go deeper

Related: [power-and-heat](power-and-heat), [buck-topology-intuition](buck-topology-intuition), [brownout-and-por](brownout-and-por). Curriculum: Track 3 "Power", step 1 — dropout discovered by sweeping Vin. Canonical reference: your regulator datasheet's dropout-vs-load-current curve and thermal-resistance table.
