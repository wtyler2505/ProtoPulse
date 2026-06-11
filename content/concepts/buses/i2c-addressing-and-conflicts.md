---
slug: i2c-addressing-and-conflicts
title: I2C addressing & conflicts
ercCodes: []
---

## What it is

Every I2C transaction opens with a 7-bit address plus a read/write bit, and every device on the bus compares that address against its own. The scheme only works if every address is unique — and addresses are assigned by chip designers from a small space, so collisions between unrelated parts are routine.

## Why it bites

Two devices sharing an address is the ghost-story failure: both answer simultaneously, and because I2C is open-drain wired-AND, their responses merge bitwise — the master reads a third value that neither device sent. Reads look *plausible* and wrong, sensors swap identities, and an address scan shows one healthy device where two are fighting. Nothing errors; everything lies. The other classic bite is pure notation: datasheets and libraries disagree about whether "the address" is the 7-bit value or the 8-bit write byte (address shifted left, R/W appended). The same sensor is "0x76" in one document and "0xEC" in another, and a library configured with the wrong convention scans a bus full of working hardware and finds nothing.

## The numbers

The 7-bit space holds 128 values, of which 16 are reserved by the specification — 112 usable, shared across every I2C chip ever made, so collisions are a *when*, not an *if*. Escape hatches, in escalating order: many parts have one or more address-select pins giving two to eight choices (strap them deliberately — they are read like [boot-strap-pins](boot-strap-pins)); some parts allow reprogramming their address over the bus itself; past that, an I2C multiplexer puts duplicates on separate downstream segments; and 10-bit addressing exists in the spec but hobby-relevant parts rarely use it. When debugging, always convert everything to 7-bit form first — half of all "address conflicts" are notation conflicts.

## See it

The failure-puzzle catalog ships this one: a bus with two devices strapped to the same address, where reads come back blended. Run the address scan, see one innocent-looking responder, then probe SDA during a read and watch two devices fight for the line bit by bit.

## Go deeper

Related: [i2c-electrical-model](i2c-electrical-model), [boot-strap-pins](boot-strap-pins), [reading-a-datasheet](reading-a-datasheet), [push-pull-vs-open-collector](push-pull-vs-open-collector). Curriculum: Track 4 "Talking Chips", step 2 — the address scan exercise. Canonical reference: NXP UM10204 §3.1.12 (reserved addresses), plus your sensor's "slave address" section, read twice.
