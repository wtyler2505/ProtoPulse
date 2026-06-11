---
slug: esd-handling-truth-vs-ritual
title: ESD handling — truth vs ritual
ercCodes: []
---

## What it is

Electrostatic discharge damage is real, physical, and mostly invisible: your body charges to kilovolts through ordinary movement, and touching a pin delivers that charge through junction structures rated for far less. The truth is potential *equalization*; the rituals are everything people do instead.

## Why it bites

The nasty property of ESD is *latent* damage. A zap rarely kills a part outright on the bench — it wounds it: a partially punctured gate oxide, a degraded junction that still measures fine. The board works, ships, and fails weeks later in the field, where nobody connects the failure to the day it was handled on a wool sweater. This is why "I've never grounded myself and nothing ever died" is survivorship reasoning — the casualties fail far from the crime scene. The most exposed victims are the usual suspects: discrete MOSFET gates (see [mosfet-gate-basics](mosfet-gate-basics) — tens of volts of oxide rating versus thousands on your fingertip), and any unprotected pin wired straight to a connector the user touches. Modern ICs carry on-chip protection that makes them robust to *handling*, not invulnerable — protection diodes absorb a defined event, not a habit.

## The numbers

Textbook figures, order-of-magnitude: walking across carpet in dry air can charge a body to several kilovolts — and you don't feel a discharge below roughly 3kV, so "I never feel sparks" means nothing below that line. Humidity matters enormously; dry winter air multiplies the problem. What actually works is cheap: a wrist strap to a common point (through its built-in ~1MΩ resistor — the resistor is for *your* safety), a dissipative mat, parts kept in their conductive bags until use, and the free habit of touching chassis/ground before touching pins. What's mostly ritual: anti-static bags used as work mats (the outside is not the inside), brief talisman-touches of a radiator followed by ten minutes of charging back up, and worrying about robust through-hole jellybeans while hand-feeding bare MOSFETs.

## See it

There's no sim for a wounded oxide — that's the lesson. The failure ProtoPulse *can* show is the design-side fix: protection at every connector pin a human touches, which Track 7's Probe front end builds in from the first revision.

## Go deeper

Related: [mosfet-gate-basics](mosfet-gate-basics), [floating-inputs](floating-inputs), [zener-clamping](zener-clamping), [reading-a-datasheet](reading-a-datasheet) (HBM ratings live there). Curriculum: Track 7 "Build the Probe" — input protection is step one of the front end. Canonical reference: any semiconductor vendor's ESD/HBM application note.
