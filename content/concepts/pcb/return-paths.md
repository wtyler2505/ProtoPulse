---
slug: return-paths
title: Return paths
ercCodes: []
---

## What it is

Every signal current is a loop: whatever flows out a trace must flow back to its source, through ground, power, or whatever copper is available. At DC the return takes the geometrically shortest path; at high frequency it hugs the underside of the signal trace, because that's the lowest-inductance route.

## Why it bites

You route a clean-looking trace across the board, but a slot in the ground plane — a connector cutout, a row of vias, a split between "analog" and "digital" ground — sits under it. The return current can't follow the trace; it detours around the slot, opening a big loop. Symptom: a board that works on the bench but fails EMC, an ADC that reads noise correlated with some unrelated signal, crosstalk between traces that never touch. The schematic shows one "ground" node; the layout decides which copper the return actually uses (see [ground-three-meanings](ground-three-meanings)). Splitting grounds to be "careful" usually makes this worse, not better.

## The numbers

The crossover between "shortest path" and "hugs the trace" happens at surprisingly low frequency — order of tens to hundreds of kilohertz for typical board geometries, so anything with fast edges (every digital signal, every switcher) behaves in the high-frequency regime. Edge rate matters more than clock rate: a 1MHz signal with nanosecond edges has return current behaving like a 100MHz+ signal. These are intuitions, not formulas — the honest rule is geometric: never route a signal over a gap in its reference plane, and on a 2-layer board keep the bottom copper under signals as unbroken as you can.

## See it

ProtoPulse's PCB editor is 2-layer (F.Cu/B.Cu), which is exactly where return paths get interesting. Pour a ground zone on B.Cu, route signals on F.Cu, and look at where your bottom-side traces carve channels through the pour — every channel is a forced return detour. DRC's isolated-island check will flag pour fragments that connect to nothing, but it can't see a bad detour; that judgment is yours.

## Go deeper

Related: [loop-area](loop-area) (what the detour costs you), [ground-three-meanings](ground-three-meanings), [zones-and-thermal-reliefs](zones-and-thermal-reliefs), [stackup-basics](stackup-basics) (why a layer-2 plane fixes most of this), [local-decoupling](local-decoupling). Curriculum: Track 6 "First Board" makes you find your own return paths before routing power. Canonical reference: any "ground is a myth, return current is real" signal-integrity text — Ott or Bogatin cover it definitively.
