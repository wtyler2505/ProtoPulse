---
slug: diff-pairs-at-hobby-scale
title: Diff pairs at hobby scale
ercCodes: []
---

## What it is

A differential pair carries one signal as the difference between two complementary traces, so noise that hits both equally cancels at the receiver. At hobby scale the pairs that matter are the ones the standards force on you: USB, CAN, Ethernet.

## Why it bites

Two opposite failures. The neglect failure: you route USB D+ and D− as two unrelated traces wandering across the board, the impedance is wherever it landed, and enumeration gets flaky — the device that works on one cable and not another, or only on USB 1.1 speeds. The ritual failure costs differently: hours spent serpentine-matching a CAN pair to a tenth of a millimetre when CAN at hobby bitrates tolerates centimetres of skew — effort that buys nothing ([can-basics](can-basics)). Knowing which failure you're near is the whole skill. A truth that surprises people: most of each trace's field couples to the ground plane, not to its partner — "loose coupling" — so an unbroken reference plane under the pair matters more than how tightly the pair hugs.

## The numbers

All roughly, limits stated: USB full-speed is famously forgiving — short pair, consistent spacing, solid plane underneath, and skew within a few millimetres is fine; high-speed (480Mbps) wants real 90Ω differential impedance, which a 2-layer 1.6mm board can't honestly deliver — keep those runs very short. CAN at 500kbps has bit times of microseconds; length matching is ritual there, termination is what's real ([termination-at-hobby-scale](termination-at-hobby-scale)). Length matching starts mattering when skew approaches a meaningful fraction of the edge time — roughly, millimetres matter for gigabit-class signals, and don't for kilohertz ones.

## See it

Not in ProtoPulse yet: there's no diff-pair routing mode, impedance control, or length matching in the editor — saying otherwise would be a lie. What you can do today is the part that matters most at hobby scale: route the two traces side by side manually with consistent spacing on F.Cu, pour an unbroken ground zone on B.Cu beneath them, and run DRC for clearance. The pair-aware tooling is roadmap; the plane discipline is available now.

## Go deeper

Related: [stackup-basics](stackup-basics) (why impedance needs the stackup), [return-paths](return-paths), [termination-at-hobby-scale](termination-at-hobby-scale), [can-basics](can-basics), [impedance-vs-resistance](impedance-vs-resistance). Curriculum: Track 7 "Build the Probe" routes a real USB connection and applies exactly this triage. Canonical reference: the USB and CAN specs' layout guidance, plus your fab's impedance calculator when you graduate to 4 layers.
