---
slug: base-resistor-sizing
title: Base resistor sizing
ercCodes: []
---

## What it is

The base resistor converts your GPIO's voltage into the base *current* a BJT actually runs on. Sizing it is one line of Ohm's law — but it's the line that decides whether your transistor is a switch or a space heater.

## Why it bites

Too big and the transistor never saturates: it carries the load current while dropping real voltage, runs hot, and the load runs dim or slow — the failure is gradual and easy to misblame on the load. Too small (or absent) and you're hauling pointless current out of the GPIO pin: the base-emitter junction clamps near 0.7V, the pin supplies whatever the resistor allows, and you can crowd the pin's current limit — brown the I/O driver, sag the rail, or just waste battery on base drive that buys nothing past saturation. Both failure modes ship working demos; both die in the field, one thermally and one electrically.

## The numbers

The recipe, in order. Load current first: say 100mA. Base current next, using the switching rule of thumb (forced beta ≈ 10, deliberately ignoring the optimistic linear-region hFE): Ib = 100mA / 10 = 10mA. Then Ohm's law across what's left of the drive voltage after the base-emitter drop (~0.7V for silicon): R = (Vgpio − 0.7) / Ib. From a 3.3V pin: R = 2.6V / 10mA = 260Ω, so 270Ω from the standard values. Now the sanity check, with its limit stated: 10mA is within the absolute-maximum rating of many MCU pins but past the *comfortable* continuous figure for some — check your chip's per-pin and total-port limits, and if the demanded base current is rude, that's the signal to switch to a MOSFET or add a driver stage rather than to quietly undersize the drive.

## See it

Sim the 3.3V-GPIO → 100mA-load switch three ways: 10kΩ base resistor (transistor half-on, Vce high, load starved), 270Ω (saturated, cool, load at full strength), and no resistor at all (watch the GPIO current readout do something the pin's datasheet would not enjoy).

## Go deeper

Related: [bjt-as-a-switch](bjt-as-a-switch), [ohms-law-in-practice](ohms-law-in-practice), [pull-up-pull-down](pull-up-pull-down). Curriculum: Track 2 "Signals & Switches", step 4. Canonical reference: your MCU datasheet's GPIO current ratings beside the transistor's Vce(sat) test conditions.
