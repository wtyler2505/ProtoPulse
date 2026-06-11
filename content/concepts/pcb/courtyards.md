---
slug: courtyards
title: Courtyards
ercCodes: []
---

## What it is

A courtyard is the keep-out boundary around a footprint — the rectangle the physical part actually occupies, including body overhang, plus a margin for placement tolerance. Pads tell you where the copper goes; the courtyard tells you where the *part* goes, and the two are not the same.

## Why it bites

You place two parts by their pads, the pads don't touch, DRC-style copper checks pass — and the assembled board comes back with one part sitting on top of its neighbor, or a connector shell that won't seat because an electrolytic cap's body leans into it. Courtyard overlap is an assembly failure that no electrical check catches. The slower version of the same bite: parts placed legally but packed so tight that there's no room for an iron tip or hot tweezers, so the first rework attempt collateral-damages three neighbors. Tall parts next to connectors, crystal cans under daughterboards, and the underside of anything that mates with a case are the repeat offenders.

## The numbers

Typical courtyard margins are roughly 0.25mm beyond the part body for normal-density work, tighter (roughly 0.1mm) only when you've accepted hand-placement precision or you genuinely need the density. The limit of the rule: courtyards encode *placement* tolerance, not rework access — leaving iron-tip room around anything you expect to replace is a separate, larger allowance that no standard mandates. Also remember height: courtyards are 2D, and a 2D check can't tell you a 12mm cap fouls your enclosure lid. Measure the real part; never guess body sizes from the pad pattern.

## See it

ProtoPulse's PCB editor shows footprints with their physical outlines, so overlap is visible as you place — but there's no automated courtyard-overlap DRC check today; the JLCPCB deck checks copper rules (clearance, trace width, annular ring), not part bodies. Place two parts deliberately too close and notice the DRC stays green: that gap between "passes DRC" and "can be assembled" is the lesson.

## Go deeper

Related: [silk-discipline](silk-discipline) (the other assembly-survival discipline), [soldering-driven-footprint-choices](soldering-driven-footprint-choices) (choose parts you can actually rework), [panelization](panelization) (edge clearance is courtyard thinking at board scale), [annular-rings](annular-rings). Curriculum: Track 6 "First Board" includes a placement review pass before any routing starts. Canonical reference: IPC-7351 defines courtyard excess by density class.
