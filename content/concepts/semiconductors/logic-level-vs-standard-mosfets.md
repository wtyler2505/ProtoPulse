---
slug: logic-level-vs-standard-mosfets
title: Logic-level vs standard MOSFETs
ercCodes: []
---

## What it is

A "standard" power MOSFET expects roughly 10V on its gate to turn fully on; a "logic-level" part is built to get there from 5V or less. The label isn't a spec, though — the spec is the gate voltage printed next to each Rds(on) figure, and that's the only line that settles whether a FET works in *your* circuit.

## Why it bites

You buy a FET whose listing screams logic-level, drive it from a 3.3V MCU, and the motor runs — slowly, while the FET cooks. "Logic level" historically meant *5V* logic; plenty of parts wearing the label are only fully enhanced at 4.5V and are mediocre at 3.3V and hopeless at 2.5V. The datasheet was never hiding this: the Rds(on) table quotes each value at a stated Vgs, and if there's no row at or below your gate voltage, the manufacturer is telling you they make no promises there. The transfer curve says the rest. This is the Track 2 rite of passage — "why your logic-level FET isn't, at 3.3V" — and the fix is either a FET genuinely characterized at your voltage or a gate-driver stage that gives the FET the volts it wants.

## The numbers

Read three things, in this order. One: the Rds(on) rows — a standard FET might be specified only at Vgs = 10V; a true low-voltage part will have rows at 4.5V and 2.5V. Two: the transfer characteristic (drain current vs Vgs) — at your gate voltage, can the part carry your load current with margin, at your worst-case temperature? Three: Vgs(max), commonly around ±20V for power FETs — gate drive has a ceiling too, and exceeding it kills the insulation that makes a MOSFET a MOSFET. Rule with its limit: marketing categories drift; test-condition columns don't.

## See it

Sim the same load switched by two FET models — one fully enhanced at your 3.3V drive, one only partially — and compare dissipation readouts. Then raise the gate drive to 5V and watch the "bad" FET become a fine one: nothing was broken except the assumption.

## Go deeper

Related: [mosfet-gate-basics](mosfet-gate-basics), [gate-charge-and-switching-loss](gate-charge-and-switching-loss), [reading-a-datasheet](reading-a-datasheet). Curriculum: Track 2 "Signals & Switches", step 5. Canonical reference: any power-FET datasheet's Rds(on) table — read the conditions column before the values column.
