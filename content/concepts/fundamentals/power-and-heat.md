---
slug: power-and-heat
title: Power and heat
ercCodes:
  - ERC-CURRENT-BUDGET
---

## What it is

Power is voltage times current, P = V × I, and in a resistive part it's equivalently I²R — every watt your circuit dissipates becomes heat somewhere. Parts carry power ratings because heat, not electricity, is what usually kills them.

## Why it bites

The smell of a cooking resistor is the smell of a skipped calculation. A 1/4W resistor asked to drop 12V at 50mA is dissipating 0.6W — it will discolor, drift, and eventually char, sometimes weeks after it "worked fine" on the bench. The sneakier version is the budget failure: each load on a rail is individually fine, but together they pull more than the regulator, the trace, or the battery can deliver, and the symptom is a rail that sags under load and resets your microcontroller. That's the failure the current-budget ERC check exists to catch before the bench does.

## The numbers

P = V × I exactly; for resistors, P = I²R means doubling the current quadruples the heat. Common through-hole resistors are rated 1/4W; small SMD packages often less (an 0402 is typically rated around 1/16W — check the datasheet). The seasoned habit is to derate: keep continuous dissipation at or below about half the rating, since ratings assume free air at 25°C and your enclosure is neither. For rails, sum the worst-case draws of every load and compare against the source's continuous rating — not its peak.

## See it

Put a 100Ω resistor directly across a 9V battery in the sim: P = 9²/100 = 0.81W, more than triple a 1/4W rating. Watch the power readout, then add a current_max constraint of 50mA to the net and run ERC — the budget check fails exactly the way the part would have.

## Go deeper

Related: [voltage-vs-current](voltage-vs-current), [ohms-law-in-practice](ohms-law-in-practice), [duty-cycle](duty-cycle). Curriculum: Track 1 "First Light", step 5 (first-light-05). Canonical reference: Horowitz & Hill, *The Art of Electronics*, §1.2 and resistor datasheet derating curves.
