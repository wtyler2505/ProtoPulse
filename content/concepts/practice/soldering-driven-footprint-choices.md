---
slug: soldering-driven-footprint-choices
title: Soldering-driven footprint choices
ercCodes: []
---

## What it is

A footprint is an assembly decision, not just an electrical one: the package you pick decides whether *you*, with *your* tools, can attach and rework the part. The best schematic in the world ships as a board you have to build.

## Why it bites

The bite comes at the bench, weeks after the design felt finished. The bargain sensor you picked exists only in a leadless QFN with a center thermal pad — unsolderable with an iron alone, because the pad you must wet is entirely under the part. The regulator's tab needs more heat than your iron delivers into a ground pour, so you get a cold joint that passes inspection and fails at temperature. The 0402 passives sized "to be safe" tombstone, skitter, and vanish into the carpet. And rework is the hidden half: a part you managed to solder once but cannot remove without hot air turns every debugging hypothesis involving that part into a board-risking operation. None of this is visible in the schematic editor; all of it was decided there.

## The numbers

Common hand-assembly practice, hedged because skill and tooling vary widely: 0805 and 0603 passives are comfortable with an iron; 0402 is possible but punishing; 0201 is realistically machine territory. SOIC (1.27mm pitch) is beginner-friendly; TSSOP and 0.5mm-pitch QFPs are fine with flux and drag-soldering once practiced; QFN/DFN and anything with hidden or bottom-side pads wants hot air or a stencil-and-paste reflow; BGA is reflow-with-verification territory. Helpful levers: choose the hand-solder footprint variant (extended pad lengths) where your library offers one, prefer packages with leads you can see and touch, and leave probe-able test points — your future debugging self is part of the assembly plan. For one-off prototypes, a breakout module for the one impossible package is a legitimate engineering decision, not cheating.

## See it

Track 6 makes this concrete at footprint-assignment time: the unplaced tray forces an explicit package choice per part, and the deck check that follows runs against real fab limits — choices made here are the ones your iron meets later.

## Go deeper

Related: [reading-a-datasheet](reading-a-datasheet) (the package drawing section), [power-and-heat](power-and-heat) (thermal pads exist for a reason), [esd-handling-truth-vs-ritual](esd-handling-truth-vs-ritual). Curriculum: Track 6 "First Board", step 1 — footprint assignment. Canonical reference: the package/land-pattern drawing in the part's datasheet plus IPC-7351 land-pattern conventions.
