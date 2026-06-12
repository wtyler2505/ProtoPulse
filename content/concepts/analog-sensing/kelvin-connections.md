---
slug: kelvin-connections
title: Kelvin connections
ercCodes: []
---

## What it is

A Kelvin (four-wire) connection separates the path that *carries* the current from the path that *measures* the voltage. The sense wires tap directly at the element under measurement and carry almost no current — so the wiring's own resistance drops almost no voltage and tells no lies.

## Why it bites

The bite arrives the moment you measure small resistances with big currents. You fit a 10mΩ shunt from [shunt-current-sensing](shunt-current-sensing), route the sense trace from a convenient point a few centimeters down the power trace, and the amplifier dutifully reports the shunt *plus* that stretch of copper — which can rival the shunt itself. The error scales with current, so the reading is "calibrated" at one load and wrong at every other; it drifts with temperature, because copper's resistance does; and it changes when you re-route the board, which is the moment most people discover the trace was part of the measurement all along. The same disease hits battery testing (lead resistance masquerading as cell resistance), low-ohm resistor measurement with a two-wire multimeter, and any "why does my current reading depend on where I probe?" mystery.

## The numbers

Textbook copper: a 1oz (35µm) PCB trace runs roughly 0.5mΩ per square at room temperature, and copper's resistance rises about 0.4% per °C. So five squares of power trace between shunt and sense tap is ~2.5mΩ — a 25% error on a 10mΩ shunt, before self-heating moves it further. The fix costs nothing: route two dedicated sense traces from the shunt's own pads (the inner pads, on four-terminal shunts built for this), carrying only the amplifier's bias current — microamps, dropping nanovolts. Sense traces can be thin; they are honest *because* no current flows.

## See it

In the sim, model the shunt and two short trace resistances explicitly, then compare sense taps at the shunt pads versus past the traces while sweeping load current: one reading tracks the shunt, the other grows an error that scales with the very current you're measuring.

## Go deeper

Related: [shunt-current-sensing](shunt-current-sensing), [ground-three-meanings](ground-three-meanings), [impedance-vs-resistance](impedance-vs-resistance), [series-vs-parallel](series-vs-parallel). Curriculum: Track 5 "Moving Things", step 5 — the Kelvin-connection concept arrives with shunt sizing. Canonical reference: any four-terminal shunt datasheet's recommended layout drawing.
