---
slug: resistor-power-sizing
title: Resistor power sizing
ercCodes: []
---

## What it is

A resistor's value says how much it resists; its power rating says how much heat it can shed before it cooks. Sizing the wattage is a separate calculation from picking the ohms, and skipping it is how "correct" circuits char.

## Why it bites

The 330Ω dropper on your indicator LED never gets warm, so you stop thinking about wattage — then you reuse the same habit on a 12V rail dropper, a motor snubber, or a dummy load, and the part browns, smells, and drifts upward in value until the circuit stops making sense. The cruel part is the timescale: an overloaded resistor often survives the bench demo and dies over the following weeks, so the failure shows up far from the mistake. The other trap is pulse blindness in reverse — a resistor that's fine for a 10ms inrush burst would be ash if that current were continuous, so "it survived power-up" proves nothing about steady state.

## The numbers

P = V²/R = I²R, exactly — note the squares: doubling the voltage across a resistor quadruples its heat. A 47Ω resistor across 5V dissipates about 0.53W, already past two 1/4W ratings. Common through-hole parts are 1/4W; small SMD sizes are rated lower (an 0603 is typically around 1/10W — check the datasheet, ratings vary by series). The working rule, with its limit stated: keep continuous dissipation at or below about half the rating, because ratings assume free air at 25°C and a generous pad layout, and your build has neither. Brief pulses can exceed the continuous rating — by how much is a per-series datasheet curve, not a guess.

## See it

Put a 47Ω resistor across the 5V rail in the sim and read the power readout: ~0.53W. Swap in 470Ω and watch it fall to ~53mW — one digit of resistance moved the heat by a factor of ten. Then sweep the supply from 5V to 12V and watch P climb with the square.

## Go deeper

Related: [power-and-heat](power-and-heat), [ohms-law-in-practice](ohms-law-in-practice), [led-forward-current](led-forward-current). Curriculum: Track 1 "First Light" applies it at LED scale; Track 2's "why is my transistor hot" puzzle is the same math wearing a different package. Canonical reference: any film-resistor datasheet's derating curve and pulse-load chart, read once against a part you actually own.
