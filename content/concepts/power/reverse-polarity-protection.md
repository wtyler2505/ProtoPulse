---
slug: reverse-polarity-protection
title: Reverse-polarity protection
ercCodes: []
---

## What it is

Reverse-polarity protection is the circuit that lets your board survive its power being connected backwards. The three classic schemes, in rising order of elegance: a series diode, a series Schottky, or a P-channel MOSFET in the high side acting as a near-lossless ideal diode.

## Why it bites

Barrel jacks ship in both polarities, battery holders accept cells backwards, and screw terminals don't care about your silkscreen. The unprotected failure is instantaneous and total: electrolytic capacitors are polarized and can vent, ICs conduct through their substrate diodes and short, and the board is dead before your hand leaves the connector. The protected-but-careless failure is subtler: a series silicon diode "works" but eats 0.6–0.7V — fatal in a 3.3V battery design — and at real current it becomes a heater. The MOSFET scheme has its own footnote: at first contact, current flows through the FET's body diode until the gate biases the channel on; and the gate-source voltage must stay within its rating, which on higher-voltage inputs means a Zener and resistor to clamp it.

## The numbers

Diode loss is exact: P = Vf × I. At 2A, silicon's ~0.7V burns about 1.4W; a Schottky's typically 0.3–0.45V roughly halves that, at the price of higher reverse leakage. The P-FET drop is I × Rds(on) — with milliohm-class parts that's millivolts and milliwatts, which is why it wins battery designs. Hedge: Vgs maximum ratings are commonly around ±20V, but that's a per-part datasheet number; clamp the gate when the input can exceed it.

## See it

In the sim, build all three schemes feeding the same load, then flip the source. All three block. Now flip it back and compare the forward drops: ~0.7V, ~0.4V, and nearly nothing. Watch the diode's dissipation climb with load current while the FET's barely registers.

## Go deeper

Related: [diode-drop-and-flyback](diode-drop-and-flyback), [schottky-vs-silicon](schottky-vs-silicon), [body-diode](body-diode), [zener-clamping](zener-clamping). Curriculum: Track 3 "Power", step 5 — protect the input, simulate the mistake first. Canonical reference: Horowitz & Hill on reverse-battery protection, plus your FET datasheet's Vgs(max) and Rds(on) tables.
