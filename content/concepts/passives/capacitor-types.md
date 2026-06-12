---
slug: capacitor-types
title: Capacitor types, honestly
ercCodes: []
---

## What it is

"Capacitor" names a family, not a part: ceramic, electrolytic, film, and tantalum trade capacitance density against stability, lifetime, and honesty about their printed value. The three-character codes on ceramics (C0G, X7R, Y5V) are the manufacturer telling you exactly how much the part will lie.

## Why it bites

You buy a bag of cheap "1µF" ceramics, use one in a timing circuit, and the timing drifts with the weather — a Y5V part can swing wildly over temperature, and class-2 ceramics also quietly lose capacitance the moment you put DC voltage across them. A "1µF" rated at 6.3V, used on a 5V rail, may be delivering a small fraction of its label; the only truth is the DC-bias curve in the datasheet. Electrolytics bite differently: they're polarized (reversed ones vent or pop), they dry out over years — especially hot ones near regulators — and aging electrolytics are one of the most common failures in old gear. Each type fails in its own dialect; the bug is using one type where another's vices matter.

## The numbers

The EIA class-2 codes are defined tolerances over temperature: X7R holds ±15% from −55 to +125°C; Y5V is allowed +22/−82% over a narrower range — that minus-82 is in the spec, not a slur. C0G/NP0 (class 1) is the stable one — use it for timing and filters where the farads must be real. DC-bias loss on class-2 parts can be half or more of the rated value at rated voltage; the standard defense is to buy a voltage rating comfortably above the rail (twice is a common habit) and check the curve. Aluminum electrolytics commonly carry asymmetric tolerances like −20/+80% — fine for bulk storage, absurd for timing.

## See it

Build an RC delay in the sim with the capacitance set to the label value, then re-run it at 40% of that value — the realistic case for a biased Y5V — and watch your "200ms" delay shrink. Same schematic, different honesty.

## Go deeper

Related: [esr-and-why-it-matters](esr-and-why-it-matters), [rc-time-constants](rc-time-constants), [tolerance-stacking](tolerance-stacking). Curriculum: Track 3 "Power", step 2 — the decoupling demo is where type choice gets visceral. Canonical reference: any MLCC datasheet's DC-bias characteristic curve, plus the EIA temperature-code table.
