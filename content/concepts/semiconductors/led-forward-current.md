---
slug: led-forward-current
title: LED forward current
ercCodes: []
---

## What it is

An LED is a diode: below its forward voltage it does nothing, and above it the current climbs steeply for tiny increases in voltage. You don't set an LED's brightness with voltage — you set it with current, and the series resistor is what turns a voltage supply into a current decision.

## Why it bites

Wire an LED straight across a supply "just to test" and the steep diode curve does the rest: there's no resistance to absorb the difference, the current runs away, and the LED flashes once — brightly, briefly, biographically. The slower version of the same bite is the dim-and-drifting LED running just past its knee on a too-big resistor and a marginal rail. The trap that catches careful people is assuming forward voltage is one number: it differs by color, by part, by temperature, and unit-to-unit — so LEDs in parallel sharing one resistor split current unevenly, and the lowest-Vf LED hogs the current and ages fastest ([series-vs-parallel](series-vs-parallel) covers why).

## The numbers

The resistor formula is Ohm's law across the leftover voltage: R = (Vsupply − Vf) / I. Forward voltages, hedged because they genuinely vary: red LEDs typically drop around 1.8–2.2V; blue and white typically around 2.7–3.4V — check the datasheet, and note the test current it quotes Vf at. Indicator current is a choice, not a constant: classic indicator LEDs were run at 10–20mA, but modern parts are clearly visible at 1–5mA, and on a battery design that difference is the budget. Worked example: 5V supply, red LED (~2V), 10mA target → R = 3V / 10mA = 300Ω; the resistor dissipates only 30mW, fine for any package.

## See it

This is Track 1's opening move: place an LED across the battery in the sim, watch the current readout blow past the part's rating, and let the model "burn out." Add 300Ω, re-run, and sweep the resistor to plot brightness against R — the curve is the lesson.

## Go deeper

Related: [ohms-law-in-practice](ohms-law-in-practice), [diode-drop-and-flyback](diode-drop-and-flyback), [duty-cycle](duty-cycle). Curriculum: Track 1 "First Light", steps 1–2 — failure first, derivation second. Canonical reference: any indicator-LED datasheet's Vf and absolute-maximum-current lines, read together.
