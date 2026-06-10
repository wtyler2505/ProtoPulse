---
slug: series-vs-parallel
title: Series vs parallel
ercCodes:
  - ERC-SINGLE-PORT-NET
---

## What it is

Series means one path: the same current threads every part, and their voltage drops add up. Parallel means shared terminals: every part sees the same voltage, and their currents add up.

## Why it bites

Parallel LEDs off one shared resistor look symmetrical on the schematic and aren't in real life: the LED with the slightly lower forward voltage hogs the current, glows brighter, heats up, drops even less voltage, and eventually dies — then its siblings inherit the extra current and follow. Series bites differently: stack three 2V LEDs on a 5V rail and nothing lights, because the drops add to more than the supply. And the half-wired version of both — a wire that connects to only one pin — is a circuit that simply doesn't exist yet, which is why ERC flags single-pin nets as dangling.

## The numbers

Series resistors add: R_total = R1 + R2. Parallel resistors combine as R_total = (R1 × R2)/(R1 + R2); two equal resistors halve. For series LED strings, budget the sum of forward drops plus at least ~0.5–1V of headroom for the resistor to regulate with — tighter than that and tolerance eats your margin. For parallel LEDs, the honest rule: one resistor per LED. A forward-voltage mismatch of just 0.1V between "identical" LEDs can skew their currents dramatically, since the difference lands across a few ohms of dynamic resistance.

## See it

Build two copies: two LEDs in series with one resistor, and two LEDs in parallel sharing one resistor. Run both and compare per-LED current. Then give each parallel LED its own resistor and watch the currents equalize.

## Go deeper

Related: [tolerance-stacking](tolerance-stacking), [ohms-law-in-practice](ohms-law-in-practice), [voltage-vs-current](voltage-vs-current). Curriculum: Track 1 "First Light", step 3 (first-light-03). Canonical reference: Horowitz & Hill, *The Art of Electronics*, §1.2–1.3.
