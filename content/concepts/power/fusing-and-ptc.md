---
slug: fusing-and-ptc
title: Fusing and PTC resettable fuses
ercCodes: []
---

## What it is

A fuse is a sacrificial weak link: when fault current flows, it melts open and the rest of the circuit lives. A PTC "polyfuse" is the resettable cousin — a polymer device whose resistance jumps by orders of magnitude when fault current heats it, then recovers after power is removed and it cools.

## Why it bites

Both the absence and the misuse bite. Unfused, a short across a battery — especially lithium — delivers whatever the cell can source, and the wiring harness or PCB trace becomes the fuse: it glows, smokes, and sometimes ignites. Misfused is sneakier. A fuse sized at the nominal current "nuisance-blows" on inrush at every cold start; a fuse sized far above what the downstream wiring survives protects the fuse holder and nothing else. PTCs carry their own footnotes: they trip in *seconds* at modest overload, not microseconds, so they protect against fire, not against electronics damage; they have real resistance all the time, costing you voltage at full load; and a "tripped" PTC isn't open — it leaks enough current to keep the fault warm and itself latched until power is fully removed.

## The numbers

The counterintuitive textbook fact: a fuse *holds* its rated current indefinitely — opening requires overload, and the time-current curve is the contract: at twice the rating, opening typically takes seconds, not instants (the exact curve is in the datasheet). PTCs are specified by a hold current (carries forever) and a trip current (guarantees tripping), typically about a factor of two apart, with trip time falling as overload grows — again, the curve is the spec. The sizing discipline: fuse above worst legitimate current including inrush, below what your wiring and traces can carry without becoming heaters.

## See it

In the sim, short the output rail downstream of a PTC model: current spikes, then collapses to a trickle as the device heats and trips — and stays at that trickle until you remove power entirely. Replace it with an ideal fuse model and the same fault simply opens.

## Go deeper

Related: [power-and-heat](power-and-heat), [inrush-limiting](inrush-limiting), [resistor-power-sizing](resistor-power-sizing), [ntc-inrush-limiting](ntc-inrush-limiting). Curriculum: Track 3 "Power", step 5 — protecting the input. Canonical reference: the fuse or PTC datasheet's time-current curves and hold/trip current table.
