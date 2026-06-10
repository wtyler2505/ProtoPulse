---
slug: ferrite-beads-are-not-inductors
title: Ferrite beads are not inductors
ercCodes: []
---

## What it is

A ferrite bead is a component designed to *waste* high-frequency energy as heat, while an inductor is designed to *store* energy and give it back. They look alike on a schematic and both block fast signals, but a bead is closer to a frequency-dependent resistor than to a coil.

## Why it bites

You read "600Ω ferrite bead" and mentally file it as a 600Ω part — then wonder why it does nothing to your DC rail (its DC resistance is a tiny fraction of an ohm) or why it didn't filter the noise you cared about (that 600Ω is the impedance at one specific test frequency, conventionally 100MHz, and the bead may offer far less at your actual noise frequency). The subtler bite: beads lose effectiveness as DC current flows through them — bias current pushes the ferrite toward saturation and the rated impedance quietly shrinks, so the bead protecting a hungry rail filters far less than its label. And substituting a bead where the design needs a real inductor — in a switching converter's energy path — fails completely, because dissipating energy is the opposite of storing it.

## The numbers

The impedance printed on a bead is specified at a stated test frequency, most commonly 100MHz; at low megahertz it can be a small fraction of that, and at DC it's essentially a wire. The datasheet's impedance-vs-frequency curve is the part's real identity — the resistive region of that curve (where the bead dissipates rather than resonates) is where it does honest filtering work. Derating with bias current is real and vendor-specific: the same bead can lose a large share of its impedance at a fraction of its rated current. No rule of thumb survives here; the curves are the spec.

## See it

In the sim, model a bead as a resistance that rises with frequency, between a noisy supply and a quiet analog rail, with a capacitor to ground on the quiet side. Sweep the noise frequency: low-frequency hum walks straight through, megahertz hash dies. Replace the bead with a plain wire and watch the hash arrive intact.

## Go deeper

Related: [inductor-saturation](inductor-saturation), [impedance-vs-resistance](impedance-vs-resistance), [esr-and-why-it-matters](esr-and-why-it-matters). Curriculum: not yet bound to a track step — nearest neighbor is Track 3's decoupling work. Canonical reference: a ferrite-bead datasheet's impedance-vs-frequency and impedance-vs-bias-current curves.
