---
slug: si-prefixes-4k7
title: SI prefixes and 4k7 notation
ercCodes: []
---

## What it is

Electronics spans about fifteen orders of magnitude, so values ride on SI prefixes: pico, nano, micro, milli, kilo, mega. Schematics also use the R/k/M-as-decimal-point convention — 4k7 means 4.7kΩ, 0R1 means 0.1Ω — because a stray decimal point dies in a photocopy, and a wrong value survives into your build.

## Why it bites

A thousand-fold error looks like a typo and behaves like sabotage. Order "100nF" capacitors and receive 100pF because someone read a vendor listing wrong, and your 555 timer runs a thousand times faster than designed. Type 4.7 into a BOM field that expected ohms-with-prefix and you've put a 4.7Ω resistor where 4.7k belonged — your "current limiter" now passes a thousand times the intended current. These failures are invisible on the schematic; they only show up as smoke or as timing that's wildly off.

## The numbers

The ladder, each step ×1000: p (10⁻¹²), n (10⁻⁹), µ (10⁻⁶), m (10⁻³), unity, k (10³), M (10⁶). Conversions worth making reflexive: 1000pF = 1nF, 1000nF = 1µF, 4k7 = 4700Ω, 0R47 = 0.47Ω. Capacitor markings compound the danger: a ceramic stamped "104" means 10 × 10⁴ pF = 100nF — that's a code, not a value. The hedge: when a value seems to make your circuit behave a thousand times off, check the prefix before checking the math.

## See it

Build the classic 555 blinker with 100µF and watch it blink about once a second; swap to 100nF and the "blink" becomes a kilohertz-range buzz you can only see on the sim's waveform view. Three letters, three orders of magnitude, same schematic.

## Go deeper

Related: [ohms-law-in-practice](ohms-law-in-practice), [tolerance-stacking](tolerance-stacking), [duty-cycle](duty-cycle). Curriculum: Track 1 "First Light", step 2 (first-light-02). Canonical reference: BIPM SI brochure (prefix table) and IEC 60062 for the R/k/M letter coding.
