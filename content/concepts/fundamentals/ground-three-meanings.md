---
slug: ground-three-meanings
title: Ground — three meanings
ercCodes:
  - ERC-RAIL-SHORT
---

## What it is

"Ground" is one word for three different things: the reference point you measure voltages against, the return path current actually flows through, and the literal earth connection for safety. Schematics use one symbol; real circuits punish you for assuming they're the same node.

## Why it bites

The classic bench mystery: your sensor reads fine until the motor runs, then the readings dance. Both share "ground," but the motor's return current flows through the same skinny wire as your sensor's reference, and the wire's resistance turns amps of return current into millivolts of moving reference — your ADC faithfully reports the noise. The catastrophic version is treating two different rails as interchangeable grounds and strapping them together: two supplies' outputs shorted into each other, which is exactly the rail-short the ERC screams about. And mixing earth ground into signal ground without thought creates loops that hum at line frequency.

## The numbers

Copper isn't free: a 0.2mm² hookup wire runs roughly 0.1Ω per meter, so 1A of return current down a meter of it lifts your "ground" by about 100mV — enough to swamp a 10-bit ADC reading. The working rules of thumb: return high-current paths separately and join grounds at one point (star grounding); keep reference and power returns distinct when currents exceed tens of milliamps. These are heuristics, not laws — at radio frequencies, ground behaves differently again, and plane-based layouts supersede star advice.

## See it

Build a battery, an LED load, and a long thin "ground wire" modeled as a 0.5Ω resistor in the return path. Probe the voltage between the load's ground pin and the battery's negative terminal while the LED switches: your "0V" node visibly bounces.

## Go deeper

Related: [voltage-vs-current](voltage-vs-current), [impedance-vs-resistance](impedance-vs-resistance), [floating-inputs](floating-inputs). Curriculum: Track 1 "First Light", step 4 (first-light-04). Canonical reference: Henry Ott, *Electromagnetic Compatibility Engineering*, grounding chapters.
