---
slug: impedance-vs-resistance
title: Impedance vs resistance
ercCodes: []
---

## What it is

Resistance opposes current the same way at every frequency; impedance is the generalization that includes how capacitors and inductors push back differently as frequency changes. A capacitor is an open circuit to DC and nearly a wire to fast edges — impedance is the number that captures that slide.

## Why it bites

You buy a multimeter, measure a capacitor as "open," and conclude it does nothing in your circuit — then remove the "useless" 100nF next to a chip and the chip starts crashing on every motor start. The capacitor was doing its job at megahertz, where your DC-thinking couldn't see it. The reverse bite: you treat a long wire as "just a wire," but its inductance turns fast current edges into voltage spikes — the wire was a component all along, just not at the frequency you were imagining.

## The numbers

A capacitor's impedance magnitude is 1/(2πfC): a 100nF cap is about 16kΩ at 100Hz, 16Ω at 100kHz, and 0.16Ω at 10MHz. An inductor's is 2πfL, climbing with frequency. These formulas are exact for ideal parts and sine waves; real parts add parasitics — every capacitor has some series inductance that makes it *worse* above its self-resonant frequency, which is why datasheets plot impedance curves instead of quoting one number. Rule of thumb with its limit stated: treat any conductor as having roughly 1nH per millimeter of length — good for estimation, useless for precision RF work.

## See it

Drive a 100nF capacitor through a 1kΩ resistor with a square wave and watch the output on the sim scope at 10Hz, 1kHz, and 100kHz: the same two parts act as a pass-through, a filter, and a near-short depending only on frequency.

## Go deeper

Related: [ohms-law-in-practice](ohms-law-in-practice), [rms-vs-peak](rms-vs-peak), [ground-three-meanings](ground-three-meanings). Curriculum: Track 1 wrap-up reading, ahead of Track 2's timing networks. Canonical reference: Horowitz & Hill, *The Art of Electronics*, §1.7 (reactance and impedance).
