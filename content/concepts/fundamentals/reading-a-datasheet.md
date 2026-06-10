---
slug: reading-a-datasheet
title: Reading a datasheet
ercCodes:
  - ERC-NC-CONNECTED
  - ERC-UNKNOWN-PART
  - ERC-UNKNOWN-PIN
---

## What it is

A datasheet is the manufacturer's contract for a part: pinout, absolute maximums, recommended operating conditions, and the characteristic curves that say how it really behaves. Reading one is a skill with a method — pinout first, absolute maximums second, typical-application schematic third.

## Why it bites

The pin-1 mistake is the rite of passage: you wire a transistor or regulator from memory, the package pinout differs between manufacturers of the "same" part, and it runs backwards or hot. Subtler bites hide in the fine print: "NC" pins that the datasheet says to leave unconnected but you used as a convenient solder anchor — some "NC" pins are factory test pins that do connect internally, which is why the ERC flags anything wired to one. And the most common bite of all is designing against a part you never actually looked up: a guessed pinout or an invented pin is exactly what the unknown-part and unknown-pin findings exist to catch before copper does.

## The numbers

Absolute maximum ratings are where damage begins, not where operation is allowed — design inside the *recommended operating conditions* table instead, and treat the gap between them as the manufacturer's margin, not yours. Read the test conditions next to every number: an output rated to sink 8mA "at VOL = 0.4V" will sink more at a higher, uglier output voltage; a "typical" current is a marketing average while "max" is the contract. Rule of thumb with its limit: trust min/max columns for design, use typical columns only for estimation — typicals aren't guaranteed by anyone.

## See it

Place a part the registry doesn't know (or reference a pin that doesn't exist on one it does) and run ERC: the unknown-part and unknown-pin warnings anchor to the exact component. Then open the NE555 datasheet beside the seed library's 555 and verify all eight pins against the DIP-8 pinout table — the seed part's provenance note records exactly that check.

## Go deeper

Related: [floating-inputs](floating-inputs), [power-and-heat](power-and-heat), [tolerance-stacking](tolerance-stacking). Curriculum: Track 1 "First Light", step 4 (first-light-04) — your first ERC findings link here. Canonical reference: the TI NE555 datasheet, read end to end once, slowly.
