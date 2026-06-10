---
slug: mosfet-gate-basics
title: MOSFET gate basics
ercCodes: []
---

## What it is

A MOSFET switches with gate *voltage* where a BJT needs base *current* — the gate is insulated, so once it's charged, holding a MOSFET on costs essentially nothing. The catch is the word "charged": the gate is a capacitor, and everything tricky about MOSFETs lives in filling and emptying it.

## Why it bites

The threshold-voltage trap catches almost everyone once. The datasheet says Vgs(th) = 2V, your GPIO swings 3.3V, so you're fine — except Vgs(th) is defined as the voltage where the FET *barely begins* to conduct, typically at a fraction of a milliamp by the datasheet's own test condition. It is the "off" specification, not the "on" one. Drive a power FET just above threshold and it conducts your amps while dropping volts: a half-on heater, same disease as the under-driven BJT. The on-state truth lives in the Rds(on) table and which Vgs each row was measured at ([logic-level-vs-standard-mosfets](logic-level-vs-standard-mosfets) is that story). Second bite: an unconnected gate is a floating input with amplification — during boot, before your MCU drives the pin, a power FET with a floating gate can drift on from leakage and coupled noise. A gate pull-down (100k is a common choice) defines "off" until the firmware shows up.

## The numbers

Threshold is a leakage-scale definition — treat it as where the FET stops being off. For real switching, find the Rds(on) row at a gate voltage you can actually supply; conduction loss is then I²·Rds(on), and milliohm-range FETs make that tiny. Holding the gate steady draws no meaningful current, but each switch event moves the gate charge Qg through your driver — at PWM speeds that becomes real current and real transition loss ([gate-charge-and-switching-loss](gate-charge-and-switching-loss) does the math). A small series gate resistor (tens of ohms, typically) tames ringing without much slowing.

## See it

In the sim, drive a power-FET model at three gate voltages — just above threshold, midway, and fully enhanced — into the same load, and watch drain voltage and FET dissipation: heater, warm switch, cold switch.

## Go deeper

Related: [logic-level-vs-standard-mosfets](logic-level-vs-standard-mosfets), [gate-charge-and-switching-loss](gate-charge-and-switching-loss), [floating-inputs](floating-inputs). Curriculum: Track 2 "Signals & Switches", step 5. Canonical reference: a power-MOSFET datasheet's Vgs(th) test condition next to its Rds(on) table.
