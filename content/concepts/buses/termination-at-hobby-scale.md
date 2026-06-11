---
slug: termination-at-hobby-scale
title: Termination at hobby scale
ercCodes: []
---

## What it is

When a wire is long compared to how fast your signal's edges are, it stops being "a wire" and starts being a transmission line: edges travel down it, hit the far end, and reflect back. Termination — usually a small series resistor at the driver — absorbs those reflections. The honest hobby question isn't *how*, it's *when this actually matters*.

## Why it bites

The symptom is ringing: a scope shows overshoot past the rail and a damped oscillation after every edge. Mostly it's cosmetic at hobby scale — until it isn't. A reflection that swings back through a logic threshold double-clocks a counter or shifts SPI data by one bit, intermittently, only at higher clock speeds, only on the longer cable. Overshoot beyond the rails forward-biases input clamp diodes, the same quiet damage path described in [5v-tolerance-myths](5v-tolerance-myths). The trap that catches builders: edge speed is set by the output driver, *not* your clock frequency. A modern MCU pin switches in a few nanoseconds whether you're clocking at 100kHz or 10MHz — so "it's only a slow signal" doesn't exempt the wiring.

## The numbers

Textbook rule of thumb, limits stated: treat a connection as a transmission line when its one-way propagation delay exceeds roughly one-sixth of the signal's rise time (you'll also see one-tenth from the cautious). Signals propagate at very roughly 15–20cm per nanosecond in typical cable and PCB dielectrics — so a 3ns edge starts caring somewhere around the tens-of-centimeters mark, conveniently the length of a sensor cable. The hobby-scale fix is almost always source termination: a series resistor at the driver, conventionally somewhere in the 22–100Ω range, sized so driver impedance plus resistor roughly matches the line. It costs nothing when unneeded and tames ringing when needed. Parallel termination at the receiver belongs to genuinely matched-impedance buses — like CAN's 120Ω, see [can-basics](can-basics) — not to a GPIO jumper wire.

## See it

In the sim, drive a modeled length of wire with a fast edge and probe the far end: overshoot and ring-back. Add 47Ω at the source and re-run — the edge arrives once, cleanly. Then slow the *edge* (not the clock) and watch the problem evaporate without any resistor.

## Go deeper

Related: [bus-capacitance](bus-capacitance), [spi-modes](spi-modes), [can-basics](can-basics), [impedance-vs-resistance](impedance-vs-resistance). Curriculum: Track 4 "Talking Chips" — long sensor cables are where hobby builds first meet reflections. Canonical reference: Howard Johnson & Martin Graham, *High-Speed Digital Design* (the "black magic" book), chapter on line termination.
