---
slug: acid-traps
title: Acid traps
ercCodes: []
---

## What it is

An acid trap is an acute angle in copper — a trace meeting a pad or another trace at less than 90° — where, in the old wet-etch story, etchant pools in the sharp crevice and keeps eating after the bath ends, undercutting the joint. It's the canonical reason your tools nudge you toward 45° corners.

## Why it bites

Here's the honest part: on a modern board from a reputable fab, it mostly doesn't. Photolithography, etch chemistry, and process control have improved to the point that major fabs don't list acute angles as a defect source, and DRC decks (including the JLCPCB deck ProtoPulse uses) don't check for them. The residual real cases: bargain-basement or DIY etching (home toner-transfer boards genuinely do undercut at sharp angles), extremely fine geometries near a fab's process floor where any etch variation is a larger fraction of the feature, and sharp slivers of copper or soldermask so thin they detach or wick. The bite today is more often social than physical — a reviewer flags your acute angles, and you should know whether to fix or defend.

## The numbers

There's no threshold to cite, which is itself the finding: no mainstream fab capability page publishes an "acute angle" limit. The surviving rules of thumb with limits attached: avoid copper slivers narrower than the fab's minimum trace (0.127mm on the JLCPCB 2-layer deck) regardless of angle — slivers are real, angles mostly aren't; and keep the 45° habit anyway, because it produces shorter traces, cleaner copper, and no arguments, at zero cost. A habit that's free and harmless doesn't need a horror story to justify it.

## See it

ProtoPulse's router works in the standard 45° idiom, and the DRC checks what actually matters — minimum trace width and clearance — rather than hunting angles. Deliberately drag a trace into a pad at a sharp angle: DRC stays green, the fab would build it fine, and now you know the difference between a real rule and an inherited one.

## Go deeper

Related: [trace-width-vs-current](trace-width-vs-current) (the width minimums that are real), [zones-and-thermal-reliefs](zones-and-thermal-reliefs) (pour slivers, the genuine sharp-copper hazard), [esd-handling-truth-vs-ritual](esd-handling-truth-vs-ritual) (the same truth-vs-ritual triage applied to handling), [annular-rings](annular-rings). Curriculum: Track 6 "First Board" teaches routing idiom and which DRC rules carry physics behind them. Canonical reference: your fab's capability page — note what's absent from it as much as what's on it.
