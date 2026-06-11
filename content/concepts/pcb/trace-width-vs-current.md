---
slug: trace-width-vs-current
title: Trace width vs current
ercCodes: []
drcCodes: [DRC-TRACE-WIDTH]
---

## What it is

A trace is a resistor, and current through resistance makes heat; trace width sets how much copper is available to carry that current without cooking. Sizing is about acceptable temperature rise, not a hard "max amps" — the copper doesn't fail at a line, it just gets hotter.

## Why it bites

The failure is rarely a dramatic fuse-blow (though a dead short through a 0.15mm trace can do that, sometimes usefully). The common version is quieter: a motor supply trace routed at default signal width runs warm, drops a few hundred millivolts at stall current, and your "5V" rail at the far end browns out the MCU exactly when the motor loads it ([brownout-and-por](brownout-and-por), [battery-sag-under-load](battery-sag-under-load)). You debug it as a firmware reset bug for a day. Internal layers are worse off than external ones — no air cooling — which matters when you graduate past 2-layer.

## The numbers

Classic IPC-2152-style intuition for 1oz (35µm) external copper, for roughly a 10°C rise: about 0.25–0.3mm of width per amp at low currents, easing off as currents grow — call it roughly 1mm for 3A, a few mm for 5A and up. These are order-of-magnitude planning numbers, not gospel: real capacity depends on trace length, nearby copper, ambient temperature, and whether the trace can shed heat into a plane. Internal layers need roughly twice the width for the same rise. For voltage drop (often the real constraint), 1oz copper is roughly 0.5mΩ per square — a long thin trace adds up fast at amps. JLCPCB's 2-layer minimum trace is 0.127mm; that's a fab limit for signals, not a current rating.

## See it

ProtoPulse's DRC runs the JLCPCB 2-layer deck and flags traces under 0.127mm (DRC-TRACE-WIDTH). It checks manufacturability, not current capacity — no thermal simulation exists in the editor, so widening power traces is on you. Route a power net, then deliberately set it to minimum width and imagine 2A through it: the DRC stays green, and that's the lesson.

## Go deeper

Related: [power-and-heat](power-and-heat), [resistor-power-sizing](resistor-power-sizing) (same I²R reasoning), [vias-thermal-and-signal](vias-thermal-and-signal) (the choke points between layers), [zones-and-thermal-reliefs](zones-and-thermal-reliefs) (when a trace becomes a pour), [power-budgeting](power-budgeting). Curriculum: Track 6 "First Board" sizes every power trace from the current budget before routing. Canonical reference: IPC-2152 for current capacity — most online trace-width calculators are loose interpretations of it.
