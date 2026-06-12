---
slug: thermal-runaway
title: Thermal runaway
ercCodes: []
---

## What it is

Thermal runaway is a feedback loop: heat makes a part conduct more, conducting more makes more heat, and the loop spirals until something fails. It's not overload in the ordinary sense — a circuit can be inside every rating at room temperature and still be a slow-motion avalanche.

## Why it bites

Bipolar transistors are the textbook case: a hot BJT conducts more at the same drive (its base-emitter drop falls as it warms), so a transistor running warm in its linear region pulls more current, gets warmer, pulls more. The bench symptom is a part that's fine for ten minutes and then climbs — current creeping upward at constant input until the smell arrives. Parallel parts make it social: parallel BJTs or parallel LEDs never share perfectly, so the hottest one takes more current, heats further, and hogs the load until it fails — then its share dumps onto the survivors, which fail in sequence. MOSFETs partially break the loop in switching service — their channel resistance *rises* with temperature, so paralleled switching FETs self-balance — but that mercy is conditional: held in linear operation (think soft-start circuits or linear current sources), modern FETs can still concentrate heat into local hot spots and die well inside their DC ratings; the safe-operating-area curve is the document that tells the truth.

## The numbers

The seed of the loop is textbook: a silicon junction's forward drop falls roughly 2mV per °C, so at fixed voltage drive, current rises with temperature. The standard brakes are negative feedback in the circuit itself: a small emitter (ballast) resistor under each paralleled BJT — sized so it drops on the order of a few hundred millivolts at working current — converts "I'm hogging" into "my drive shrinks," stabilizing the group; series resistors do the same social work for paralleled LEDs, one each, never shared. Heatsinking helps but doesn't fix the math; it lowers the loop gain rather than removing the loop.

## See it

In the sim, run two paralleled LED models with slightly mismatched forward voltages on one shared resistor and watch the current split — badly. Give each LED its own resistor and watch the split become boring. Boring is the goal.

## Go deeper

Related: [power-and-heat](power-and-heat), [bjt-as-a-switch](bjt-as-a-switch), [led-forward-current](led-forward-current). Curriculum: not yet bound to a track step — it haunts Track 2's transistor work and Track 5's driver stages. Canonical reference: Horowitz & Hill on BJT thermal stability, plus the SOA curve in any power-FET datasheet.
