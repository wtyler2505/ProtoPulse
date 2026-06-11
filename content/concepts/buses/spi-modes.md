---
slug: spi-modes
title: SPI modes
ercCodes: []
---

## What it is

SPI has one clock and two conventions about it: idle polarity (CPOL) and which clock edge samples the data (CPHA). The four combinations are modes 0–3, and master and peripheral must agree on one — same wires, same speed, wrong mode, garbage data.

## Why it bites

The mode-mismatch signature is data shifted by one bit: IDs read back doubled or halved, the MSB lands in the wrong byte, or every value is suspiciously off by a power of two. A CPOL mismatch can make the peripheral treat the idle-to-active transition as an extra clock; a CPHA mismatch samples on the launch edge instead of the settled edge. Both produce *consistent* wrong answers, which feels like a protocol bug, not a configuration bug — people rewrite drivers for days before checking one register field. The second-order bite: a bus shared between a mode-0 device and a mode-3 device, where each transaction must reconfigure the master, and one missed reconfiguration corrupts the *next* device's transfer. And datasheets often never say "mode 2" — they show a timing diagram and expect you to read CPOL and CPHA off it yourself.

## The numbers

The whole topic is a 2-bit table. Mode 0: CPOL=0, CPHA=0 — clock idles low, sample on the rising edge. Mode 1: CPOL=0, CPHA=1 — idles low, sample on the falling edge. Mode 2: CPOL=1, CPHA=0 — idles high, sample on the falling edge. Mode 3: CPOL=1, CPHA=1 — idles high, sample on the rising edge. The general law: data is sampled on one edge and shifted on the other. Modes 0 and 3 dominate real parts; many chips accept both because the first edge looks identical when the clock has been idle. Bit order (MSB-first is the usual convention, not a law) and word size are separate agreements — check all three.

## See it

Track 4, step 3 resolves this on the analyzer: run a transfer in all four modes against a mode-0 peripheral, with the decoder showing where each mode samples. Three produce shifted garbage; the trace shows exactly which edge went wrong.

## Go deeper

Related: [cs-discipline](cs-discipline), [uart-framing-and-baud-error](uart-framing-and-baud-error), [i2c-electrical-model](i2c-electrical-model). Curriculum: Track 4 "Talking Chips", step 3 — mode 0–3 confusion resolved on the analyzer. Canonical reference: your peripheral's timing diagram — read CPOL/CPHA off the picture, not the prose.
