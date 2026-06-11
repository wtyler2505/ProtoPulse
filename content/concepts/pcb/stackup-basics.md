---
slug: stackup-basics
title: Stackup basics
ercCodes: []
---

## What it is

The stackup is the board's vertical recipe: copper layers separated by core (cured fiberglass) and prepreg (the resin sheets that bond it all). It decides how far every signal sits from its reference plane — which quietly determines most of the board's electrical behavior before you route a single trace.

## Why it bites

On a 2-layer board, signal and return can be 1.6mm apart — a canyon, electrically. Returns detour, loops open up ([loop-area](loop-area)), and you fight noise trace by trace. The same circuit on a 4-layer board with ground on layer 2 puts every top-side signal roughly 0.2mm from an unbroken plane: returns hug their signals automatically, crosstalk drops, decoupling works better. The bite is the project where you "saved money" with 2 layers on a dense, fast design and spent weeks chasing noise that a stackup change would have deleted. The other bite is impedance: USB or RF wants a specific trace geometry, and geometry depends entirely on stackup — copy a trace width between boards with different stackups and the impedance comes along broken.

## The numbers

Hobby-scale orientation, all roughly: standard 2-layer board is 1.6mm thick with 1oz (35µm) copper; a typical 4-layer stackup puts layers 1–2 about 0.1–0.2mm apart, which is what makes the layer-2 ground plane transformative. Controlled impedance: on a 2-layer 1.6mm board, 50Ω microstrip needs a trace around 3mm wide — usually impractical, which is why impedance control effectively starts at 4 layers. Limits: exact widths come from your fab's stackup table and field-solver, not these figures; and below a few MHz with slow edges, 2 layers plus a disciplined ground pour is genuinely fine — most hobby boards live happily there.

## See it

ProtoPulse's PCB editor is 2-layer today — F.Cu and B.Cu — with no inner layers or impedance tooling; that's the honest scope. Which makes it the right place to learn the 2-layer survival skills the stackup section implies: pour B.Cu as ground, keep it unbroken under signals, and run the JLCPCB 2-layer DRC deck clean. When a project genuinely needs 4 layers, you'll know because you'll feel these limits.

## Go deeper

Related: [return-paths](return-paths) (what the plane is for), [loop-area](loop-area), [impedance-vs-resistance](impedance-vs-resistance), [diff-pairs-at-hobby-scale](diff-pairs-at-hobby-scale) (where stackup meets routing), [local-decoupling](local-decoupling). Curriculum: Track 6 "First Board" is deliberately a 2-layer design — mastering the constrained case first. Canonical reference: your fab's published stackup and impedance tables.
