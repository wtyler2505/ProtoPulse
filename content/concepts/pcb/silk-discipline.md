---
slug: silk-discipline
title: Silk discipline
ercCodes: []
---

## What it is

Silkscreen is the ink layer — reference designators, polarity marks, labels — and discipline means making it survive contact with reality: fabs clip silk that touches pads, and parts cover whatever you printed underneath them. Silk you can't read on the assembled board might as well not exist.

## Why it bites

The failure happens at the bench, months later. You're probing a dead board and the designator you need is under the part it labels — printed dead-center where the body now sits — so you're back at the layout file counting pads. Worse: a polarity mark for an electrolytic or a diode placed where the body hides it, the part goes on backwards during hand assembly, and you get the slow-bulge cap or the mystery short ([reverse-polarity-protection](reverse-polarity-protection) protects the input jack, not a backwards cap). And the fab-side version: silk drawn over pads gets auto-clipped, so your careful pin-1 dot simply vanishes from the delivered board, and nobody tells you.

## The numbers

JLCPCB's deck minimum silk line width is 0.153mm — below that, ink bleeds into unreadable fuzz; text needs to be roughly 1mm tall or more to survive printing legibly, and that's a readability floor, not a precision figure. The rules with their limits: designators go *beside* their part, oriented consistently (one or two reading directions per board, not eight); pin-1 and polarity marks go *outside* the part body so they're visible after placement; nothing on silk is load-bearing for the circuit — when boards get dense, designators are the first thing sacrificed, and a printed assembly drawing replaces them.

## See it

ProtoPulse's PCB editor carries footprints with silkscreen, and Gerber export includes the silk layers the fab will print — export and inspect what actually goes out. There's no automated silk-over-pad or silk-legibility DRC check today (the JLCPCB deck checks copper geometry), so the visible-after-placement test is a manual review pass: for every polar part, ask whether the mark survives the body.

## Go deeper

Related: [courtyards](courtyards) (the part body that hides your silk), [soldering-driven-footprint-choices](soldering-driven-footprint-choices), [reading-a-datasheet](reading-a-datasheet) (pin-1 conventions start there), [led-forward-current](led-forward-current) (LEDs: the most commonly reversed part on hobby boards). Curriculum: Track 6 "First Board" ends with a silk review against the placed 2D view. Canonical reference: your fab's capability page for silk line width and clipping behavior.
